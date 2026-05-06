// PAYLOAD 10 — OBS Broadcast Kernel: Audio Signal Probe (D004 / PAY-008)
//
// Purpose:
//   Track per-stream audio activity and gate Flicker n'Flame Scoring (FFS)
//   tier escalation above RATE_COLD on the presence of an audio signal.
//   A silent room cannot accumulate heat above the COLD band — enforced here
//   and surfaced via OBS_HEAT_ESCALATION_BLOCKED for downstream services.
//
// Doctrine:
//   • Deterministic — every probe sample with the same inputs returns the
//     same shouldAllowEscalation verdict.
//   • In-memory state only — restart-safety is delegated to FFS persistence.
//   • Silent failure = pessimistic (no escalation).
//   • correlation_id + reason_code on every NATS emission.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export const OBS_AUDIO_SIGNAL_RULE_ID = 'OBS_AUDIO_SIGNAL_v1';

/** Minimum normalised vocal ratio (0..1) to count as a present signal. */
export const AUDIO_VOCAL_PRESENCE_THRESHOLD = 0.05;

/** Window over which we treat the last positive sample as still valid (ms). */
export const AUDIO_PRESENCE_WINDOW_MS = 15_000;

/** Heat tiers above which we require an audible signal. */
const TIERS_REQUIRING_AUDIO = new Set(['WARM', 'HOT', 'INFERNO']);

interface AudioState {
  creatorId: string;
  lastPositiveAtMs: number | null;
  lastVocalRatio: number;
}

export interface AudioProbeInput {
  streamId: string;
  creatorId: string;
  /** Normalised 0..1 vocal-to-noise ratio (mirrors FFS audio_vocal_ratio). */
  vocalRatio: number;
  /** Optional override for clock injection in tests. */
  capturedAtMs?: number;
}

export interface AudioGateInput {
  streamId: string;
  proposedTier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO';
  correlationId: string;
  capturedAtMs?: number;
}

export interface AudioGateResult {
  allowed: boolean;
  reasonCode: string;
  /** True when the gate down-graded an escalation to COLD. */
  enforced: boolean;
  ruleAppliedId: string;
}

@Injectable()
export class AudioSignalService {
  private readonly logger = new Logger(AudioSignalService.name);
  private readonly state = new Map<string, AudioState>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Record a probe sample from the OBS bridge or a vision pipeline. Updates
   * the per-stream presence window. Idempotent — repeated calls with the same
   * input only update the last-positive-at timestamp.
   */
  recordSample(input: AudioProbeInput): void {
    const now = input.capturedAtMs ?? Date.now();
    const present = input.vocalRatio >= AUDIO_VOCAL_PRESENCE_THRESHOLD;

    const prior = this.state.get(input.streamId);
    const next: AudioState = {
      creatorId: input.creatorId,
      lastPositiveAtMs: present ? now : prior?.lastPositiveAtMs ?? null,
      lastVocalRatio: input.vocalRatio,
    };
    this.state.set(input.streamId, next);

    const topic = present
      ? NATS_TOPICS.OBS_AUDIO_SIGNAL_PRESENT
      : NATS_TOPICS.OBS_AUDIO_SIGNAL_ABSENT;
    this.nats.publish(topic, {
      stream_id: input.streamId,
      creator_id: input.creatorId,
      vocal_ratio: input.vocalRatio,
      threshold: AUDIO_VOCAL_PRESENCE_THRESHOLD,
      rule_applied_id: OBS_AUDIO_SIGNAL_RULE_ID,
      observed_at_utc: new Date(now).toISOString(),
    });
  }

  /**
   * Decide whether a proposed Flicker n'Flame tier escalation is permitted.
   * Tiers above COLD require a positive audio signal observed within the
   * presence window. A blocked escalation publishes
   * OBS_HEAT_ESCALATION_BLOCKED so the FFS / Hub layer can downgrade.
   */
  shouldAllowEscalation(input: AudioGateInput): AudioGateResult {
    if (!TIERS_REQUIRING_AUDIO.has(input.proposedTier)) {
      return {
        allowed: true,
        reasonCode: 'NO_AUDIO_REQUIRED',
        enforced: false,
        ruleAppliedId: OBS_AUDIO_SIGNAL_RULE_ID,
      };
    }
    const now = input.capturedAtMs ?? Date.now();
    const state = this.state.get(input.streamId);
    const lastPositive = state?.lastPositiveAtMs ?? null;
    const fresh =
      lastPositive !== null && now - lastPositive <= AUDIO_PRESENCE_WINDOW_MS;

    if (fresh) {
      return {
        allowed: true,
        reasonCode: 'AUDIO_PRESENT',
        enforced: false,
        ruleAppliedId: OBS_AUDIO_SIGNAL_RULE_ID,
      };
    }

    this.nats.publish(NATS_TOPICS.OBS_HEAT_ESCALATION_BLOCKED, {
      stream_id: input.streamId,
      creator_id: state?.creatorId ?? null,
      proposed_tier: input.proposedTier,
      reason_code: 'AUDIO_SIGNAL_ABSENT',
      correlation_id: input.correlationId,
      rule_applied_id: OBS_AUDIO_SIGNAL_RULE_ID,
      blocked_at_utc: new Date(now).toISOString(),
    });

    this.logger.warn('AudioSignalService: escalation blocked — silent room', {
      stream_id: input.streamId,
      proposed_tier: input.proposedTier,
      correlation_id: input.correlationId,
    });

    return {
      allowed: false,
      reasonCode: 'AUDIO_SIGNAL_ABSENT',
      enforced: true,
      ruleAppliedId: OBS_AUDIO_SIGNAL_RULE_ID,
    };
  }

  /** Test/audit helper — clear all in-memory state for a stream. */
  reset(streamId?: string): void {
    if (streamId) this.state.delete(streamId);
    else this.state.clear();
  }
}
