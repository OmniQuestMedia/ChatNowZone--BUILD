// PAYLOAD 5 — CreatorControl.Zone core service
// Business Plan B.3 + Canonical Corpus Chapter 4 (Creator Success).
//
// Unified creator workstation (single-pane) — aggregates:
//   • Broadcast Timing Copilot  — when to go live
//   • Session Monitoring Copilot — real-time price nudges during broadcast
//   • Flicker n'Flame Scoring (FFS) — the live-telemetry foundation
//   • OBS plugin + chat aggregator stubs (services/obs-bridge)
//
// This service is a READ + SUGGEST surface. It never writes to the ledger
// and never mutates wallet state. It publishes NATS suggestions for the
// UI panel (creator/cyrano-panel) and for the Integration Hub to fan out.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  FlickerNFlameScoringEngine,
  type FfsScore,
  type FfsSample,
} from './ffs.engine';
import {
  BroadcastTimingCopilot,
  type BroadcastWindowSuggestion,
  type TipperAvailabilityBucket,
} from './broadcast-timing.copilot';
import {
  SessionMonitoringCopilot,
  type PriceNudge,
} from './session-monitoring.copilot';

export const CREATOR_CONTROL_RULE_ID = 'CREATOR_CONTROL_ZONE_v1';
export const CREATOR_CHAT_FEED_RULE_ID = 'CREATOR-UI_v1.0';

export type ChatFeedPlatformBadge = 'CNZ' | 'OBS' | 'TWITCH' | 'YOUTUBE' | 'TIKTOK' | 'UNKNOWN';
export type ChatFeedModerationState = 'SAFE' | 'FLAGGED';
export type ChatFeedHighlightState = 'NONE' | 'HOT' | 'INFERNO';

export interface AggregatedChatFeedEntry {
  message_id: string;
  creator_id: string;
  session_id: string | null;
  user_id: string;
  content: string;
  timestamp: string;
  platform_badge: ChatFeedPlatformBadge;
  moderation_state: ChatFeedModerationState;
  moderation_reason_code: string;
  redbook_safe: boolean;
  highlight_state: ChatFeedHighlightState;
  cyrano_context: string | null;
  moderation_tools: {
    can_hide: boolean;
    can_warn: boolean;
    can_escalate: boolean;
  };
  rule_applied_id: string;
}

export interface AggregatedChatFeedMessageInput {
  id: string;
  creator_id: string;
  session_id?: string | null;
  user_id: string;
  content: string;
  timestamp?: string;
  source?: string;
  cyrano_context?: string | null;
}

export interface BuildAggregatedChatFeedArgs {
  creator_id: string;
  platform_filter?: ChatFeedPlatformBadge | 'ALL';
  moderation_filter?: ChatFeedModerationState | 'ALL';
  highlights_only?: boolean;
  limit?: number;
}

export interface CreatorWorkstationSnapshot {
  creator_id: string;
  active_session_id: string | null;
  latest_heat: FfsScore | null;
  latest_nudge: PriceNudge | null;
  top_broadcast_slots: BroadcastWindowSuggestion[];
  aggregated_chat_feed: AggregatedChatFeedEntry[];
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  captured_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class CreatorControlService implements OnModuleInit {
  private readonly logger = new Logger(CreatorControlService.name);
  // Per-creator cache of the most recent FfsScore / nudge — supports the
  // single-pane snapshot without forcing recomputation on every read.
  private readonly latestByCreator = new Map<
    string,
    { heat: FfsScore; nudge: PriceNudge }
  >();
  private readonly aggregatedChatByCreator = new Map<string, AggregatedChatFeedEntry[]>();
  private readonly latestCyranoBySession = new Map<string, { copy: string; emitted_at_utc: string }>();
  private readonly REDBOOK_SAFETY_BLOCKLIST: Array<{ pattern: RegExp; reason_code: string }> = [
    { pattern: /(?:^|\W)(cashapp|venmo|paypal|crypto|btc|eth)(?:$|\W)/i, reason_code: 'REDBOOK_OFF_PLATFORM_PAYMENT' },
    { pattern: /\b(refund|chargeback)\b/i, reason_code: 'REDBOOK_REFUND_BYPASS' },
    { pattern: /\b(telegram|whatsapp|signal)\b/i, reason_code: 'REDBOOK_OFF_PLATFORM_CONTACT' },
  ];
  private readonly AGGREGATED_CHAT_MAX_ROWS = 100;
  private readonly AGGREGATED_CHAT_MAX_CREATORS = 500;
  private readonly CYRANO_CONTEXT_MAX_SESSIONS = 1_000;

  constructor(
    private readonly nats: NatsService,
    private readonly heat: FlickerNFlameScoringEngine,
    private readonly timing: BroadcastTimingCopilot,
    private readonly monitoring: SessionMonitoringCopilot,
  ) {}

  onModuleInit(): void {
    this.nats.subscribe(NATS_TOPICS.CHAT_MESSAGE_INGESTED, (payload) => {
      const message = payload as Partial<AggregatedChatFeedMessageInput>;
      if (!message.id || !message.creator_id || !message.user_id || typeof message.content !== 'string') {
        return;
      }
      this.ingestAggregatedChatMessage({
        id: message.id,
        creator_id: message.creator_id,
        user_id: message.user_id,
        content: message.content,
        session_id: message.session_id ?? null,
        timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
        source: typeof message.source === 'string' ? message.source : undefined,
        cyrano_context: typeof message.cyrano_context === 'string' ? message.cyrano_context : undefined,
      });
    });

    this.nats.subscribe(NATS_TOPICS.CYRANO_SUGGESTION_EMITTED, (payload) => {
      const session_id = payload.session_id;
      const copy = payload.copy;
      const emitted_at_utc = payload.emitted_at_utc;
      if (
        typeof session_id !== 'string' ||
        typeof copy !== 'string' ||
        typeof emitted_at_utc !== 'string'
      ) {
        return;
      }
      this.touchMapEntry(this.latestCyranoBySession, session_id, { copy, emitted_at_utc });
      this.trimMapToMax(this.latestCyranoBySession, this.CYRANO_CONTEXT_MAX_SESSIONS);
    });
  }

  /**
   * Ingest a Flicker n'Flame Scoring (FFS) sample from ShowZone/Bijou/HeartZone and fan the
   * resulting suggestion out to the creator's copilot panel.
   */
  ingestSample(sample: FfsSample): { heat: FfsScore; nudge: PriceNudge } {
    const heat = this.heat.ingest(sample);
    const nudge = this.monitoring.suggestNudge(heat);
    this.latestByCreator.set(sample.creator_id, { heat, nudge });

    this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_SESSION_SUGGESTION, {
      creator_id: sample.creator_id,
      session_id: sample.session_id,
      heat,
      nudge,
      rule_applied_id: CREATOR_CONTROL_RULE_ID,
      timestamp: new Date().toISOString(),
    });

    // Only emit a PRICE_NUDGE topic when the suggestion is actionable
    // (direction !== HOLD) so downstream consumers don't get noise.
    if (nudge.direction !== 'HOLD') {
      this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_PRICE_NUDGE, {
        creator_id: nudge.creator_id,
        session_id: nudge.session_id,
        direction: nudge.direction,
        magnitude_pct: nudge.magnitude_pct,
        tier: nudge.tier,
        ffs_score: nudge.ffs_score,
        reason_code: nudge.reason_code,
        rule_applied_id: CREATOR_CONTROL_RULE_ID,
        captured_at_utc: nudge.captured_at_utc,
      });
    }

    return { heat, nudge };
  }

  /**
   * Run the Broadcast Timing Copilot to recommend future go-live windows.
   * This is a read query — caller supplies the 30-day availability history
   * aggregated upstream by an analytics job.
   */
  recommendBroadcastSlots(args: {
    creator_id: string;
    history: TipperAvailabilityBucket[];
    top_n?: number;
    diamond_correlated_slots?: Set<string>;
  }): BroadcastWindowSuggestion[] {
    const suggestions = this.timing.recommendTopSlots(args);

    if (suggestions.length > 0) {
      this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_BROADCAST_SUGGESTION, {
        creator_id: args.creator_id,
        suggestions,
        rule_applied_id: CREATOR_CONTROL_RULE_ID,
        timestamp: new Date().toISOString(),
      });
    }

    return suggestions;
  }

  /**
   * Build the single-pane snapshot for the /creator/control dashboard.
   * Caller passes additional surface state (OBS ready, chat aggregator
   * ready) because those live outside this service's read model.
   */
  buildWorkstationSnapshot(args: {
    creator_id: string;
    active_session_id: string | null;
    top_broadcast_slots: BroadcastWindowSuggestion[];
    aggregated_chat_feed?: AggregatedChatFeedEntry[];
    obs_ready: boolean;
    chat_aggregator_ready: boolean;
  }): CreatorWorkstationSnapshot {
    const cached = this.latestByCreator.get(args.creator_id);
    return {
      creator_id: args.creator_id,
      active_session_id: args.active_session_id,
      latest_heat: cached?.heat ?? null,
      latest_nudge: cached?.nudge ?? null,
      top_broadcast_slots: args.top_broadcast_slots,
      aggregated_chat_feed:
        args.aggregated_chat_feed ??
        this.buildAggregatedChatFeed({ creator_id: args.creator_id, limit: 25 }),
      obs_ready: args.obs_ready,
      chat_aggregator_ready: args.chat_aggregator_ready,
      captured_at_utc: new Date().toISOString(),
      rule_applied_id: CREATOR_CONTROL_RULE_ID,
    };
  }

  ingestAggregatedChatMessage(input: AggregatedChatFeedMessageInput): AggregatedChatFeedEntry {
    const sessionTier = this.latestByCreator.get(input.creator_id)?.heat.tier;
    const highlight_state: ChatFeedHighlightState =
      sessionTier === 'INFERNO'
        ? 'INFERNO'
        : sessionTier === 'HOT'
          ? 'HOT'
          : 'NONE';

    const moderation = this.evaluateRedbookSafety(input.content);
    const cyranoSuggestion = input.session_id
      ? this.latestCyranoBySession.get(input.session_id)
      : undefined;
    if (input.session_id && cyranoSuggestion) {
      this.touchMapEntry(this.latestCyranoBySession, input.session_id, cyranoSuggestion);
    }

    const entry: AggregatedChatFeedEntry = {
      message_id: input.id,
      creator_id: input.creator_id,
      session_id: input.session_id ?? null,
      user_id: input.user_id,
      content: input.content.slice(0, 500),
      timestamp: input.timestamp ?? new Date().toISOString(),
      platform_badge: this.resolvePlatformBadge(input.source),
      moderation_state: moderation.safe ? 'SAFE' : 'FLAGGED',
      moderation_reason_code: moderation.reason_code,
      redbook_safe: moderation.safe,
      highlight_state,
      cyrano_context: input.cyrano_context ?? cyranoSuggestion?.copy ?? null,
      moderation_tools: {
        can_hide: true,
        can_warn: !moderation.safe,
        can_escalate: !moderation.safe,
      },
      rule_applied_id: CREATOR_CHAT_FEED_RULE_ID,
    };

    const existing = this.aggregatedChatByCreator.get(input.creator_id) ?? [];
    const next = [entry, ...existing].slice(0, this.AGGREGATED_CHAT_MAX_ROWS);
    this.touchMapEntry(this.aggregatedChatByCreator, input.creator_id, next);
    this.trimMapToMax(this.aggregatedChatByCreator, this.AGGREGATED_CHAT_MAX_CREATORS);

    this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_CHAT_FEED_UPDATED, {
      creator_id: input.creator_id,
      message_id: entry.message_id,
      moderation_state: entry.moderation_state,
      platform_badge: entry.platform_badge,
      highlight_state: entry.highlight_state,
      redbook_safe: entry.redbook_safe,
      rule_applied_id: CREATOR_CHAT_FEED_RULE_ID,
      timestamp: entry.timestamp,
    });

    return entry;
  }

  buildAggregatedChatFeed(args: BuildAggregatedChatFeedArgs): AggregatedChatFeedEntry[] {
    const platformFilter = args.platform_filter ?? 'ALL';
    const moderationFilter = args.moderation_filter ?? 'ALL';
    const highlightsOnly = args.highlights_only ?? false;
    const limit = args.limit ?? 50;

    const creatorRows = this.aggregatedChatByCreator.get(args.creator_id) ?? [];
    if (creatorRows.length > 0) {
      this.touchMapEntry(this.aggregatedChatByCreator, args.creator_id, creatorRows);
    }

    return creatorRows
      .filter((row) => (platformFilter === 'ALL' ? true : row.platform_badge === platformFilter))
      .filter((row) => (moderationFilter === 'ALL' ? true : row.moderation_state === moderationFilter))
      .filter((row) => (highlightsOnly ? row.highlight_state !== 'NONE' : true))
      .slice(0, Math.max(limit, 0));
  }

  /** Test seam — clears the in-memory cache. */
  reset(): void {
    this.latestByCreator.clear();
    this.aggregatedChatByCreator.clear();
    this.latestCyranoBySession.clear();
    this.heat.reset();
  }

  private resolvePlatformBadge(source: string | undefined): ChatFeedPlatformBadge {
    if (!source) return 'UNKNOWN';
    const normalized = source.toUpperCase();
    if (
      normalized === 'CNZ' ||
      normalized === 'OBS' ||
      normalized === 'TWITCH' ||
      normalized === 'YOUTUBE' ||
      normalized === 'TIKTOK'
    ) {
      return normalized;
    }
    return 'UNKNOWN';
  }

  private evaluateRedbookSafety(content: string): { safe: boolean; reason_code: string } {
    for (const rule of this.REDBOOK_SAFETY_BLOCKLIST) {
      if (rule.pattern.test(content)) {
        return { safe: false, reason_code: rule.reason_code };
      }
    }
    return { safe: true, reason_code: 'REDBOOK_SAFE' };
  }

  private trimMapToMax<K, V>(map: Map<K, V>, max: number): void {
    while (map.size > max) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  }

  private touchMapEntry<K, V>(map: Map<K, V>, key: K, value: V): void {
    map.delete(key);
    map.set(key, value);
  }
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// CreatorControl.Zone is now a live single-pane workstation. It consumes
// Flicker n'Flame Scoring (FFS) samples, runs Broadcast Timing + Session Monitoring copilots,
// and publishes deterministic suggestions to NATS
// (CREATOR_CONTROL_* and FFS_SCORE_* topics).
//
// All major creator-facing systems (ledger, gateguard, recovery, diamond
// concierge, ffs, cyrano, integration hub) are now wired together.
//
// NEXT PRIORITY: full Next.js frontend polish for /creator/control and
// /creator/cyrano-panel, plus the pre-launch readiness checklist (OBS
// plugin cert, chat aggregator live on at least one non-native platform,
// Cyrano latency SLO dashboards).
