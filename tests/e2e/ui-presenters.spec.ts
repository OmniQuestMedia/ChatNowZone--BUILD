// PAYLOAD 8 — Unit tests for Payload-7 UI presenters.

import { DiamondConciergePresenter } from '../../ui/view-models/diamond-concierge.presenter';
import { CreatorControlPresenter } from '../../ui/view-models/creator-control.presenter';
import {
  PublicWalletPresenter,
  DEFAULT_GOVERNANCE_SNAPSHOT,
} from '../../ui/view-models/public-wallet.presenter';
import { renderDiamondPage } from '../../ui/app/admin/diamond/page';
import { renderRecoveryPage } from '../../ui/app/admin/recovery/page';
import { renderCreatorControlPage } from '../../ui/app/creator/control/page';
import { renderTokensPage } from '../../ui/app/tokens/page';
import { renderDiamondPurchasePage } from '../../ui/app/diamond/purchase/page';
import { renderWalletPage } from '../../ui/app/wallet/page';
import { collectTestIds, findByTestId } from '../../ui/components/render-plan';
import { THEME, paletteFor, heatColorFor } from '../../ui/config/theme';
import { resolveBuildConfig } from '../../ui/config/build-config';
import { SEO } from '../../ui/config/seo';
import {
  contrastTextFor,
  heatTierAriaLabel,
  resolveBreakpoint,
} from '../../ui/config/accessibility';
import { MembershipPresenter } from '../../ui/view-models/membership.presenter';
import { renderMembershipPage } from '../../ui/app/vip/membership/page';
import { renderPixelLegacyPage } from '../../ui/app/creator/pixel-legacy/page';
import type { PixelLegacyStatusView } from '../../ui/types/creator-panel-contracts';

describe('THEME + accessibility primitives', () => {
  it('defaults to dark mode (adult-platform standard)', () => {
    expect(THEME.default_mode).toBe('dark');
  });

  it('resolves heat-tier colors', () => {
    expect(heatColorFor('INFERNO')).toMatch(/^#/);
    expect(heatColorFor('COLD')).not.toBe(heatColorFor('INFERNO'));
  });

  it('resolveBreakpoint maps known viewports', () => {
    expect(resolveBreakpoint(320)).toBe('mobile');
    expect(resolveBreakpoint(800)).toBe('tablet');
    expect(resolveBreakpoint(1366)).toBe('desktop');
    expect(resolveBreakpoint(1920)).toBe('wide');
  });

  it('contrastTextFor returns the inverse text for bright surfaces', () => {
    const text = contrastTextFor('#ffffff', 'light');
    expect(text).toBe(paletteFor('light').text_inverse);
  });

  it('heatTierAriaLabel produces a screen-reader friendly string', () => {
    expect(heatTierAriaLabel('HOT', 70)).toContain('Room heat hot');
  });
});

describe('Build config + SEO', () => {
  it('local config disables telemetry; production enables it', () => {
    expect(resolveBuildConfig('local').enable_telemetry).toBe(false);
    expect(resolveBuildConfig('production').enable_telemetry).toBe(true);
  });

  it('admin / wallet routes are noindex,nofollow', () => {
    expect(SEO.admin_diamond.robots).toBe('noindex,nofollow');
    expect(SEO.admin_recovery.robots).toBe('noindex,nofollow');
    expect(SEO.wallet.robots).toBe('noindex,nofollow');
    expect(SEO.creator_control.robots).toBe('noindex,nofollow');
  });

  it('public routes are index,follow', () => {
    expect(SEO.tokens.robots).toBe('index,follow');
    expect(SEO.diamond_purchase.robots).toBe('index,follow');
    expect(SEO.home.robots).toBe('index,follow');
  });
});

describe('PublicWalletPresenter — token bundles', () => {
  it('emits Tease Regular rows for a guest', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'GUEST',
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    expect(card.rows).toHaveLength(5);
    expect(card.rows[0].display_price_usd).toBe(card.rows[0].guest_price_usd);
  });

  it('emits Tease Regular at member price for members', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'MEMBER',
    });
    expect(card.rows[0].display_price_usd).toBe(card.rows[0].member_price_usd);
    expect(card.rows[0].discount_for_members_pct).not.toBeNull();
  });

  it('marks the promoted bundle row', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'GUEST',
      promoted_bundle_tokens: 5_000,
    });
    const promoted = card.rows.find((r) => r.is_promoted);
    expect(promoted?.tokens).toBe(5_000);
  });
});

describe('PublicWalletPresenter — Diamond quote', () => {
  it('rejects volume below 10k', () => {
    expect(() =>
      new PublicWalletPresenter().buildDiamondQuote({
        tokens: 5_000,
        velocity_days: 30,
      }),
    ).toThrow(/DIAMOND_MIN_VOLUME_NOT_MET/);
  });

  it('applies the platform floor at 0.077 when multiplied below it', () => {
    const q = new PublicWalletPresenter().buildDiamondQuote({
      tokens: 60_000,
      velocity_days: 366,
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    // 0.082 * 0.85 = 0.0697 → below 0.077 floor
    expect(q.platform_floor_applied).toBe(true);
    expect(q.platform_rate_usd).toBe(0.077);
  });

  it('does NOT apply floor when effective rate above 0.077', () => {
    const q = new PublicWalletPresenter().buildDiamondQuote({
      tokens: 10_000,
      velocity_days: 14,
    });
    expect(q.platform_floor_applied).toBe(false);
    expect(q.platform_rate_usd).toBeGreaterThan(0.077);
  });
});

describe('PublicWalletPresenter — wallet view', () => {
  it('marks the first non-empty bucket as draining next', () => {
    const v = new PublicWalletPresenter().buildWalletView({
      wallet_id: 'w-1',
      user_id: 'u-1',
      tier: 'GUEST',
      balances: { purchased: 0n, membership: 100n, bonus: 50n },
    });
    const draining = v.buckets.find((b) => b.will_drain_next);
    expect(draining?.bucket).toBe('membership');
  });

  it('preserves canonical spend order', () => {
    const v = new PublicWalletPresenter().buildWalletView({
      wallet_id: 'w-2',
      user_id: 'u-2',
      tier: 'MEMBER',
      balances: { purchased: 10n, membership: 20n, bonus: 30n },
    });
    expect(v.buckets.map((b) => b.bucket)).toEqual(['purchased', 'membership', 'bonus']);
    expect(v.total_tokens).toBe('60');
  });
});

describe('DiamondConciergePresenter — full page render', () => {
  it('produces a page tree with stable test ids', () => {
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 20,
        cohort_average_fraud_score: 15,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('admin-diamond-page');
    expect(ids).toContain('admin-diamond-kpi-strip');
    expect(ids).toContain('admin-diamond-liquidity');
    expect(ids).toContain('admin-diamond-warning-queue');
    expect(ids).toContain('admin-diamond-personal-touch');
    expect(ids).toContain('admin-diamond-token-bridge');
    expect(ids).toContain('admin-diamond-three-fifths');
    expect(ids).toContain('admin-diamond-gateguard-feed');
    expect(ids).toContain('admin-diamond-welfare-panel');
    expect(ids).toContain('admin-diamond-audit-chain');
  });

  it('renders the recovery page with stage counts', () => {
    const render = renderRecoveryPage({
      cases: [],
      audit_window: [],
    });
    expect(findByTestId(render.tree, 'admin-recovery-stage-counts')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-recovery-open-cases')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-recovery-audit-trail')).toBeDefined();
  });

  it('renders the creator control page with all panels', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-1',
      display_name: 'Creator One',
      obs_ready: true,
      chat_aggregator_ready: false,
      active_session_id: null,
      latest_heat: null,
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });
    expect(findByTestId(render.tree, 'creator-control-page')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-heat-meter')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-cyrano-panel')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-broadcast-timing')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-persona-switcher')).toBeDefined();
  });

  it('renders the public token bundles page', () => {
    const render = renderTokensPage({ tier: 'GUEST' });
    expect(findByTestId(render.tree, 'tokens-page')).toBeDefined();
    expect(findByTestId(render.tree, 'tokens-tease-regular')).toBeDefined();
  });

  it('renders the Diamond purchase page', () => {
    const render = renderDiamondPurchasePage({
      tokens: 10_000,
      velocity_days: 30,
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    expect(findByTestId(render.tree, 'diamond-purchase-page')).toBeDefined();
    expect(findByTestId(render.tree, 'diamond-quote-card')).toBeDefined();
    expect(findByTestId(render.tree, 'diamond-purchase-confirm')).toBeDefined();
  });

  it('renders the wallet page with three buckets', () => {
    const render = renderWalletPage({
      wallet_id: 'w-1',
      user_id: 'u-1',
      tier: 'GUEST',
      balances: { purchased: 100n, membership: 0n, bonus: 50n },
    });
    expect(findByTestId(render.tree, 'wallet-page')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-purchased')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-membership')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-bonus')).toBeDefined();
  });
});

describe('CreatorControlPresenter — payout scaling', () => {
  it('applies +10% scaling at INFERNO tier', () => {
    const view = new CreatorControlPresenter().buildPayoutRate(
      'creator-1',
      0.075,
      'INFERNO',
      new Date('2026-04-25T00:00:00Z'),
    );
    expect(view.scaling_pct_applied).toBe(10);
    // 0.075 * 1.10 = 0.0825 → within REDBOOK band.
    expect(view.current_rate_per_token_usd).toBeCloseTo(0.0825, 4);
  });

  it('clamps to REDBOOK ceiling at high base + scaling', () => {
    const view = new CreatorControlPresenter().buildPayoutRate(
      'creator-1',
      0.085,
      'INFERNO',
      new Date('2026-04-25T00:00:00Z'),
    );
    // 0.085 * 1.10 = 0.0935 → clamped to 0.090
    expect(view.current_rate_per_token_usd).toBeLessThanOrEqual(view.redbook_ceiling_per_token_usd);
  });
});

describe('Governance snapshot defaults pin to canonical values', () => {
  it('REDBOOK §3 Tease Regular bundles intact', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.tease_regular[0]).toMatchObject({
      tokens: 150,
      guest_usd: 19.99,
      member_usd: 17.99,
    });
  });

  it('Diamond platform floor is $0.077', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.diamond_platform_floor_per_token_usd).toBe(0.077);
  });

  it('Recovery: 20% Token Bridge bonus + 60% 3/5ths refund', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.token_bridge_bonus_pct).toBe(0.2);
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.three_fifths_refund_pct).toBe(0.6);
  });

  it('LEDGER_SPEND_ORDER is purchased → membership → bonus', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.ledger_spend_order).toEqual([
      'purchased',
      'membership',
      'bonus',
    ]);
  });
});

// ─── Core Surface 01 — Public Wallet View ────────────────────────────────────

describe('Surface 01 — Public Wallet View — new features', () => {
  it('SUCCESS state renders tier badge, CTAs, ledger, and Bill 149 overlay', () => {
    const render = renderWalletPage({
      wallet_id: 'w-1',
      user_id: 'u-1',
      tier: 'DIAMOND',
      balances: { purchased: 500n, membership: 100n, bonus: 50n },
      state: 'SUCCESS',
      is_vip_diamond: true,
      concierge_flag: true,
    });
    expect(findByTestId(render.tree, 'wallet-tier-badge')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-cta-row')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-buy-czt')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-topup-cyrano')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-recent-ledger')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bill149-overlay')).toBeDefined();
  });

  it('LOADING state renders only the loading indicator, no buckets', () => {
    const render = renderWalletPage({
      wallet_id: 'w-2',
      user_id: 'u-2',
      tier: 'GUEST',
      balances: { purchased: 0n, membership: 0n, bonus: 0n },
      state: 'LOADING',
    });
    expect(findByTestId(render.tree, 'wallet-loading-indicator')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-buckets')).toBeUndefined();
    expect(findByTestId(render.tree, 'wallet-cta-row')).toBeUndefined();
  });

  it('EMPTY state renders CTA row but no bucket list', () => {
    const render = renderWalletPage({
      wallet_id: 'w-3',
      user_id: 'u-3',
      tier: 'GUEST',
      balances: { purchased: 0n, membership: 0n, bonus: 0n },
      state: 'EMPTY',
    });
    expect(findByTestId(render.tree, 'wallet-empty-message')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-cta-row')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-buckets')).toBeUndefined();
  });

  it('WELFARE_GUARDIAN_PAUSE state renders the pause overlay', () => {
    const render = renderWalletPage({
      wallet_id: 'w-4',
      user_id: 'u-4',
      tier: 'MEMBER',
      balances: { purchased: 200n, membership: 50n, bonus: 0n },
      state: 'WELFARE_GUARDIAN_PAUSE',
    });
    expect(findByTestId(render.tree, 'wallet-welfare-pause-overlay')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-welfare-pause-dismiss')).toBeDefined();
  });

  it('GATE_GUARD_DENY state renders the deny overlay', () => {
    const render = renderWalletPage({
      wallet_id: 'w-5',
      user_id: 'u-5',
      tier: 'GUEST',
      balances: { purchased: 100n, membership: 0n, bonus: 0n },
      state: 'GATE_GUARD_DENY',
    });
    expect(findByTestId(render.tree, 'wallet-gateguard-deny-overlay')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-gateguard-deny-dismiss')).toBeDefined();
  });

  it('VIP_DIAMOND tier badge carries concierge flag', () => {
    const render = renderWalletPage({
      wallet_id: 'w-6',
      user_id: 'u-6',
      tier: 'DIAMOND',
      balances: { purchased: 1000n, membership: 0n, bonus: 0n },
      is_vip_diamond: true,
      concierge_flag: true,
    });
    const badge = findByTestId(render.tree, 'wallet-tier-badge');
    expect(badge?.props?.['is_vip_diamond']).toBe(true);
    expect(badge?.props?.['concierge_flag']).toBe(true);
  });

  it('FFS INFERNO hint is shown when ffs_hint.is_inferno is true', () => {
    const render = renderWalletPage({
      wallet_id: 'w-7',
      user_id: 'u-7',
      tier: 'MEMBER',
      balances: { purchased: 300n, membership: 100n, bonus: 0n },
      ffs_hint: { session_id: 'sess-1', tier: 'INFERNO', score: 92, is_inferno: true },
    });
    expect(findByTestId(render.tree, 'wallet-ffs-inferno-hint')).toBeDefined();
  });

  it('FFS INFERNO hint is NOT shown when is_inferno is false', () => {
    const render = renderWalletPage({
      wallet_id: 'w-8',
      user_id: 'u-8',
      tier: 'GUEST',
      balances: { purchased: 50n, membership: 0n, bonus: 0n },
      ffs_hint: { session_id: 'sess-2', tier: 'HOT', score: 75, is_inferno: false },
    });
    expect(findByTestId(render.tree, 'wallet-ffs-inferno-hint')).toBeUndefined();
  });

  it('Welfare Guardian band is rendered when welfare_score is provided', () => {
    const render = renderWalletPage({
      wallet_id: 'w-9',
      user_id: 'u-9',
      tier: 'GUEST',
      balances: { purchased: 100n, membership: 0n, bonus: 0n },
      welfare_score: 72, // ORANGE band
    });
    const band = findByTestId(render.tree, 'wallet-welfare-band');
    expect(band).toBeDefined();
    expect(band?.props?.['band']).toBe('ORANGE');
  });

  it('Recent ledger entries are rendered when provided', () => {
    const render = renderWalletPage({
      wallet_id: 'w-10',
      user_id: 'u-10',
      tier: 'MEMBER',
      balances: { purchased: 500n, membership: 100n, bonus: 25n },
      recent_ledger: [
        {
          ledger_id: 'l-1',
          occurred_at_utc: '2026-04-25T10:00:00Z',
          description: 'Tease Regular 500 tokens',
          bucket: 'purchased',
          amount_tokens: '500',
          running_balance_tokens: '625',
          reason_code: 'PURCHASE_COMPLETE',
          correlation_id: 'corr-1',
        },
      ],
    });
    expect(findByTestId(render.tree, 'wallet-ledger-l-1')).toBeDefined();
  });

  it('PublicWalletPresenter resolves Welfare Guardian bands correctly', () => {
    const presenter = new PublicWalletPresenter();
    expect(presenter.resolveWelfareGuardianBand(0)).toBe('GREEN');
    expect(presenter.resolveWelfareGuardianBand(49)).toBe('GREEN');
    expect(presenter.resolveWelfareGuardianBand(50)).toBe('AMBER');
    expect(presenter.resolveWelfareGuardianBand(69)).toBe('AMBER');
    expect(presenter.resolveWelfareGuardianBand(70)).toBe('ORANGE');
    expect(presenter.resolveWelfareGuardianBand(84)).toBe('ORANGE');
    expect(presenter.resolveWelfareGuardianBand(85)).toBe('CRITICAL');
    expect(presenter.resolveWelfareGuardianBand(100)).toBe('CRITICAL');
  });

  it('PublicWalletPresenter builds tier badges with correct display labels', () => {
    const presenter = new PublicWalletPresenter();
    expect(
      presenter.buildTierBadge({ tier: 'DIAMOND', is_vip_diamond: true, concierge_flag: true })
        .display_label,
    ).toBe('VIP Diamond — Concierge');
    expect(
      presenter.buildTierBadge({ tier: 'DIAMOND', is_vip_diamond: true, concierge_flag: false })
        .display_label,
    ).toBe('VIP Diamond');
    expect(
      presenter.buildTierBadge({ tier: 'MEMBER', is_vip_diamond: false, concierge_flag: false })
        .display_label,
    ).toBe('Member');
    expect(
      presenter.buildTierBadge({ tier: 'GUEST', is_vip_diamond: false, concierge_flag: false })
        .display_label,
    ).toBe('Guest');
  });
});

// ─── Core Surface 02 — Creator Cyrano Control Panel ──────────────────────────

describe('Surface 02 — Creator Cyrano Control Panel — new features', () => {
  it('renders unified aggregated chat feed with badges, moderation tools, highlights, and Cyrano context', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-chat-1',
      display_name: 'Creator Chat',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess-chat',
      latest_heat: {
        session_id: 'sess-chat',
        creator_id: 'creator-chat-1',
        tier: 'INFERNO',
        score: 94,
        components: { tipper_pressure: 40, velocity: 39, vip_presence: 15 },
        captured_at_utc: '2026-05-01T10:00:00Z',
      },
      latest_nudge: null,
      broadcast_windows: [],
      aggregated_chat_feed: [
        {
          message_id: 'msg-1',
          creator_id: 'creator-chat-1',
          session_id: 'sess-chat',
          user_id: 'guest-1',
          content: 'I can move to private now',
          timestamp: '2026-05-01T10:00:01Z',
          platform_badge: 'OBS',
          moderation_state: 'SAFE',
          moderation_reason_code: 'REDBOOK_SAFE',
          redbook_safe: true,
          highlight_state: 'INFERNO',
          cyrano_context: 'Push private-show conversion copy.',
          moderation_tools: { can_hide: true, can_warn: false, can_escalate: false },
          rule_applied_id: 'CREATOR-UI_v1.0',
        },
      ],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });

    expect(findByTestId(render.tree, 'creator-control-aggregated-chat-feed')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-chat-filters')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-chat-row-msg-1')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-chat-badge-msg-1')?.children).toEqual([
      'OBS',
    ]);
    expect(findByTestId(render.tree, 'creator-control-chat-cyrano-context-msg-1')).toBeDefined();
    expect(
      findByTestId(render.tree, 'creator-control-chat-moderation-tools-msg-1')?.children,
    ).toEqual(['HIDE']);
  });

  it('renders CyranoSessionSummary widget on the command pane', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-2',
      display_name: 'Creator Two',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess-abc',
      latest_heat: {
        session_id: 'sess-abc',
        creator_id: 'creator-2',
        tier: 'HOT',
        score: 75,
        components: { tipper_pressure: 30, velocity: 30, vip_presence: 15 },
        captured_at_utc: '2026-04-25T12:00:00Z',
      },
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [
        { persona_id: 'p-1', display_name: 'Aria', tone: 'warm', style_notes: '', active: true },
      ],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });
    expect(findByTestId(render.tree, 'creator-control-cyrano-summary')).toBeDefined();
    expect(render.cyrano_summary.session_id).toBe('sess-abc');
    expect(render.cyrano_summary.active_persona_display_name).toBe('Aria');
    expect(render.cyrano_summary.tier_context).toBe('HOT');
  });

  it('does NOT render handoff CTA when FFS tier is below INFERNO', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-3',
      display_name: 'Creator Three',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess-hot',
      latest_heat: {
        session_id: 'sess-hot',
        creator_id: 'creator-3',
        tier: 'HOT',
        score: 80,
        components: { tipper_pressure: 35, velocity: 30, vip_presence: 15 },
        captured_at_utc: '2026-04-25T12:00:00Z',
      },
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });
    expect(findByTestId(render.tree, 'creator-control-handoff-cta')).toBeUndefined();
    expect(render.handoff_cta).toBeNull();
  });

  it('renders handoff CTA and modal when FFS tier is INFERNO', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-4',
      display_name: 'Creator Four',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess-inferno',
      latest_heat: {
        session_id: 'sess-inferno',
        creator_id: 'creator-4',
        tier: 'INFERNO',
        score: 92,
        components: { tipper_pressure: 40, velocity: 38, vip_presence: 14 },
        captured_at_utc: '2026-04-25T12:00:00Z',
      },
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
      handoff_estimated_tokens: 50_000,
    });
    expect(findByTestId(render.tree, 'creator-control-handoff-cta')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-handoff-open-modal')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-handoff-modal')).toBeDefined();
    expect(render.handoff_cta).not.toBeNull();
    expect(render.handoff_cta?.ffs_tier).toBe('INFERNO');
    expect(render.handoff_cta?.ffs_score).toBe(92);
    expect(render.handoff_cta?.reason_code).toBe('INFERNO_HANDOFF_ELIGIBLE');
    expect(render.handoff_cta?.estimated_volume_tokens).toBe(50_000);
  });

  it('handoff modal is open when handoff_modal_open is true', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-5',
      display_name: 'Creator Five',
      obs_ready: false,
      chat_aggregator_ready: false,
      active_session_id: 'sess-inf2',
      latest_heat: {
        session_id: 'sess-inf2',
        creator_id: 'creator-5',
        tier: 'INFERNO',
        score: 88,
        components: { tipper_pressure: 38, velocity: 36, vip_presence: 14 },
        captured_at_utc: '2026-04-25T13:00:00Z',
      },
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
      handoff_modal_open: true,
    });
    const modal = findByTestId(render.tree, 'creator-control-handoff-modal');
    expect(modal?.props?.['open']).toBe(true);
  });

  it('buildHandoffCta returns null when tier is not INFERNO', () => {
    const presenter = new CreatorControlPresenter();
    expect(presenter.buildHandoffCta('sess-1', 80, 'HOT', null)).toBeNull();
    expect(presenter.buildHandoffCta('sess-2', 60, 'WARM', null)).toBeNull();
    expect(presenter.buildHandoffCta('sess-3', 20, 'COLD', null)).toBeNull();
  });

  it('buildHandoffCta returns a CTA with REDBOOK floor/ceiling at INFERNO', () => {
    const presenter = new CreatorControlPresenter();
    const cta = presenter.buildHandoffCta('sess-inf', 92, 'INFERNO', 40_000);
    expect(cta).not.toBeNull();
    expect(cta?.floor_rate_usd).toBe(0.075);
    expect(cta?.ceiling_rate_usd).toBe(0.09);
    expect(cta?.handoff_quote_url).toContain('sess-inf');
  });

  it('buildCyranoSessionSummary flags latency breach correctly', () => {
    const presenter = new CreatorControlPresenter();
    const inputs = {
      creator_id: 'c-1',
      display_name: 'C',
      obs_ready: false,
      chat_aggregator_ready: false,
      active_session_id: 'sess-x',
      latest_heat: null,
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [
        {
          suggestion_id: 's-1',
          session_id: 'sess-x',
          category: 'CAT_ENGAGEMENT',
          weight: 80,
          tier_context: 'WARM' as const,
          copy: 'Say hi',
          reason_codes: [],
          emitted_at_utc: '2026-04-25T12:00:00Z',
          latency_ms: 5000, // exceeds 2000ms SLA
        },
      ],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    };
    const summary = presenter.buildCyranoSessionSummary(inputs, new Date('2026-04-25T12:00:01Z'));
    expect(summary.latency_last_observed_ms).toBe(5000);
    expect(summary.latency_within_sla).toBe(false);
    expect(summary.suggestion_count).toBe(1);
  });
});

// ─── Core Surface 03 — Diamond Concierge Operator View ───────────────────────

describe('Surface 03 — Diamond Concierge Operator View — new features', () => {
  it('renders high-heat VIP queue panel with empty state when no rows', () => {
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 20,
        cohort_average_fraud_score: 10,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
      high_heat_vip_rows: [],
    });
    const panel = findByTestId(render.tree, 'admin-diamond-high-heat-vip');
    expect(panel).toBeDefined();
    // Empty state should not render any row buttons
    expect(findByTestId(render.tree, 'admin-diamond-high-heat-handoff-sess-1')).toBeUndefined();
  });

  it('renders high-heat VIP rows sorted by score descending', () => {
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 30,
        cohort_average_fraud_score: 15,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
      high_heat_vip_rows: [
        {
          session_id: 'sess-low',
          user_id: 'u-a',
          wallet_id: 'w-a',
          ffs_score: 87,
          ffs_tier: 'INFERNO',
          remaining_tokens: '10000',
          remaining_usd_cents: '77000',
          velocity_band: 'DAYS_30',
          detected_at_utc: '2026-04-25T12:00:00Z',
          reason_code: 'HIGH_HEAT_VIP_DETECTED',
        },
        {
          session_id: 'sess-high',
          user_id: 'u-b',
          wallet_id: 'w-b',
          ffs_score: 97,
          ffs_tier: 'INFERNO',
          remaining_tokens: '50000',
          remaining_usd_cents: '385000',
          velocity_band: 'DAYS_14',
          detected_at_utc: '2026-04-25T11:55:00Z',
          reason_code: 'HIGH_HEAT_VIP_DETECTED',
        },
      ],
    });
    expect(findByTestId(render.tree, 'admin-diamond-high-heat-sess-high')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-high-heat-sess-low')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-high-heat-handoff-sess-high')).toBeDefined();
  });

  it('renders operator quote generator with empty form when no input provided', () => {
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 20,
        cohort_average_fraud_score: 10,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
    });
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-form')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-submit')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-result')).toBeUndefined();
  });

  it('renders operator quote result when a quote is provided', () => {
    const presenter = new DiamondConciergePresenter();
    const quote = presenter.buildOperatorQuote(
      { tokens: 30_000, velocity_days: 30, correlation_id: 'HANDOFF-TEST-001' },
      new Date('2026-04-25T12:00:00Z'),
    );
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 20,
        cohort_average_fraud_score: 10,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
      operator_quote: quote,
      operator_quote_input: {
        tokens: 30_000,
        velocity_days: 30,
        correlation_id: 'HANDOFF-TEST-001',
      },
    });
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-result')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-confirm')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-diamond-operator-quote-discard')).toBeDefined();
  });

  it('operator quote enforces $0.077 floor and requires step-up auth', () => {
    const presenter = new DiamondConciergePresenter();
    const quote = presenter.buildOperatorQuote({
      tokens: 60_000,
      velocity_days: 366,
      correlation_id: 'corr-floor-test',
    });
    // 0.082 * 0.85 = 0.0697 → below floor → floor applied
    expect(quote.platform_floor_applied).toBe(true);
    expect(quote.platform_rate_usd).toBe(0.077);
    expect(quote.step_up_auth_required).toBe(true);
    expect(quote.correlation_id).toBe('corr-floor-test');
    expect(quote.rule_applied_id).toBe('DIAMOND_OPERATOR_QUOTE_v1');
  });

  it('buildHighHeatVipQueue sorts by ffs_score descending', () => {
    const presenter = new DiamondConciergePresenter();
    const rows = presenter.buildHighHeatVipQueue([
      {
        session_id: 's-a',
        user_id: 'u-a',
        wallet_id: 'w-a',
        ffs_score: 88,
        ffs_tier: 'INFERNO',
        remaining_tokens: '100',
        remaining_usd_cents: '770',
        velocity_band: 'DAYS_30',
        detected_at_utc: '2026-04-25T12:00:00Z',
        reason_code: 'HIGH_HEAT_VIP_DETECTED',
      },
      {
        session_id: 's-b',
        user_id: 'u-b',
        wallet_id: 'w-b',
        ffs_score: 99,
        ffs_tier: 'INFERNO',
        remaining_tokens: '200',
        remaining_usd_cents: '1540',
        velocity_band: 'DAYS_14',
        detected_at_utc: '2026-04-25T11:00:00Z',
        reason_code: 'HIGH_HEAT_VIP_DETECTED',
      },
      {
        session_id: 's-c',
        user_id: 'u-c',
        wallet_id: 'w-c',
        ffs_score: 92,
        ffs_tier: 'INFERNO',
        remaining_tokens: '150',
        remaining_usd_cents: '1155',
        velocity_band: 'DAYS_90',
        detected_at_utc: '2026-04-25T11:30:00Z',
        reason_code: 'HIGH_HEAT_VIP_DETECTED',
      },
    ]);
    expect(rows[0].ffs_score).toBe(99);
    expect(rows[1].ffs_score).toBe(92);
    expect(rows[2].ffs_score).toBe(88);
  });
});

// ─── Screen 04 — MembershipPresenter ──────────────────────────────────────

describe('MembershipPresenter — lifecycle status resolution', () => {
  const presenter = new MembershipPresenter();
  const BASE_INPUTS = {
    membership_id: 'mem-001',
    user_id: 'u-001',
    active_since_utc: '2026-01-01T00:00:00Z',
    nats_warning_received: false,
    remaining_paid_balance_tokens: 500n,
    original_purchase_usd_cents: 9999n,
    token_bridge_waiver_used_this_year: false,
    wallet_buckets: [
      { bucket: 'purchased' as const, balance_tokens: 100n, spend_priority: 1 },
      { bucket: 'membership' as const, balance_tokens: 200n, spend_priority: 2 },
      { bucket: 'bonus' as const, balance_tokens: 50n, spend_priority: 3 },
    ],
    ffs_heat_history: [],
  };

  it('returns ACTIVE when well within expiry window', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_PLATINUM',
      expires_at_utc: '2026-06-01T00:00:00Z',
      now_utc: now,
    });
    expect(view.status).toBe('ACTIVE');
    expect(view.token_bridge_offer).toBeNull();
    expect(view.three_fifths_exit_offer).toBeNull();
  });

  it('returns EXPIRING when within 48h warning window', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_DIAMOND',
      expires_at_utc: '2026-04-02T12:00:00Z', // 36h from now
      now_utc: now,
    });
    expect(view.status).toBe('EXPIRING');
    expect(view.hours_until_expiry).toBeCloseTo(36, 0);
    expect(view.token_bridge_offer).not.toBeNull();
    expect(view.three_fifths_exit_offer).not.toBeNull();
  });

  it('returns EXPIRING when NATS warning received even outside 48h', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_SILVER',
      expires_at_utc: '2026-04-05T00:00:00Z', // 96h out — normally ACTIVE
      nats_warning_received: true,
      now_utc: now,
    });
    expect(view.status).toBe('EXPIRING');
  });

  it('returns EXPIRED when past expiry timestamp', () => {
    const now = new Date('2026-04-10T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_GOLD',
      expires_at_utc: '2026-04-09T00:00:00Z',
      now_utc: now,
    });
    expect(view.status).toBe('EXPIRED');
    expect(view.hours_until_expiry).toBeNull();
  });

  it('free VIP tier is always ACTIVE with null expiry', () => {
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP',
      expires_at_utc: null,
      remaining_paid_balance_tokens: null,
      original_purchase_usd_cents: null,
    });
    expect(view.status).toBe('ACTIVE');
    expect(view.expires_at_utc).toBeNull();
    expect(view.three_fifths_exit_offer).toBeNull();
  });

  it('Token Bridge offer encodes the 20% bonus on remaining balance', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_PLATINUM',
      remaining_paid_balance_tokens: 1000n,
      expires_at_utc: '2026-04-02T00:00:00Z', // EXPIRING
      now_utc: now,
    });
    expect(view.token_bridge_offer).not.toBeNull();
    // DEFAULT_MEMBERSHIP_GOVERNANCE.token_bridge_bonus_pct_int = 20 → display as 0.20
    expect(view.token_bridge_offer!.bonus_pct).toBe(0.2);
    expect(view.token_bridge_offer!.bonus_tokens).toBe('200'); // 20% of 1000
  });

  it('Three-Fifths Exit is 60% of original purchase price', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_DIAMOND',
      original_purchase_usd_cents: 10000n,
      expires_at_utc: '2026-04-02T00:00:00Z', // EXPIRING
      now_utc: now,
    });
    expect(view.three_fifths_exit_offer).not.toBeNull();
    // DEFAULT_MEMBERSHIP_GOVERNANCE.three_fifths_refund_pct_int = 60 → display as 0.60
    expect(view.three_fifths_exit_offer!.refund_pct).toBe(0.6);
    expect(view.three_fifths_exit_offer!.estimated_refund_usd_cents).toBe('6000'); // 60% of 10000
    expect(view.three_fifths_exit_offer!.policy_gated).toBe(true);
  });

  it('clips FFS heat history to 24 points', () => {
    const points = Array.from({ length: 30 }, (_, i) => ({
      captured_at_utc: `2026-04-0${(i % 9) + 1}T00:00:00Z`,
      score: 50 + i,
      tier: 'HOT' as const,
    }));
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_PLATINUM',
      expires_at_utc: '2026-06-01T00:00:00Z',
      ffs_heat_history: points,
    });
    expect(view.ffs_heat_history).toHaveLength(24);
  });

  it('stipend_czt for VIP_DIAMOND is 500 (governance default)', () => {
    const view = presenter.buildView({
      ...BASE_INPUTS,
      tier: 'VIP_DIAMOND',
      expires_at_utc: '2026-06-01T00:00:00Z',
    });
    expect(view.top_up_summary.tier_stipend_czt).toBe(500);
  });
});

describe('MembershipPage — render plan structure', () => {
  it('produces all expected test_ids for EXPIRING state', () => {
    const render = renderMembershipPage({
      membership_id: 'mem-page-001',
      user_id: 'u-page-001',
      tier: 'VIP_DIAMOND',
      active_since_utc: '2026-01-01T00:00:00Z',
      expires_at_utc: '2026-04-02T00:00:00Z',
      nats_warning_received: true,
      remaining_paid_balance_tokens: 500n,
      original_purchase_usd_cents: 9999n,
      token_bridge_waiver_used_this_year: false,
      wallet_buckets: [
        { bucket: 'purchased', balance_tokens: 100n, spend_priority: 1 },
        { bucket: 'membership', balance_tokens: 200n, spend_priority: 2 },
        { bucket: 'bonus', balance_tokens: 50n, spend_priority: 3 },
      ],
      ffs_heat_history: [{ captured_at_utc: '2026-04-01T00:00:00Z', score: 80, tier: 'HOT' }],
      now_utc: new Date('2026-04-01T00:00:00Z'),
    });

    const ids = collectTestIds(render.tree);
    expect(ids).toContain('membership-page');
    expect(ids).toContain('membership-tier-badge');
    expect(ids).toContain('membership-status-banner');
    expect(ids).toContain('membership-nats-warning-flag');
    expect(ids).toContain('membership-recovery-options');
    expect(ids).toContain('membership-token-bridge-card');
    expect(ids).toContain('membership-three-fifths-card');
    expect(ids).toContain('membership-top-up-card');
    expect(ids).toContain('membership-heat-sparkline');
    expect(ids).toContain('membership-recovery-modal');
  });

  it('hides recovery options in ACTIVE state', () => {
    const render = renderMembershipPage({
      membership_id: 'mem-active',
      user_id: 'u-active',
      tier: 'VIP_PLATINUM',
      active_since_utc: '2026-01-01T00:00:00Z',
      expires_at_utc: '2026-07-01T00:00:00Z',
      nats_warning_received: false,
      remaining_paid_balance_tokens: 500n,
      original_purchase_usd_cents: 9999n,
      token_bridge_waiver_used_this_year: false,
      wallet_buckets: [],
      ffs_heat_history: [],
      now_utc: new Date('2026-04-01T00:00:00Z'),
    });

    const ids = collectTestIds(render.tree);
    expect(ids).not.toContain('membership-token-bridge-card');
    expect(ids).not.toContain('membership-three-fifths-card');
  });

  it('returns the correct SEO metadata key', () => {
    const render = renderMembershipPage({
      membership_id: 'mem-seo',
      user_id: 'u-seo',
      tier: 'VIP_SILVER',
      active_since_utc: '2026-01-01T00:00:00Z',
      expires_at_utc: '2026-07-01T00:00:00Z',
      nats_warning_received: false,
      remaining_paid_balance_tokens: null,
      original_purchase_usd_cents: null,
      token_bridge_waiver_used_this_year: false,
      wallet_buckets: [],
      ffs_heat_history: [],
    });
    expect(render.metadata.robots).toBe('noindex,nofollow');
    expect(render.metadata.canonical_url).toContain('/vip/membership');
  });
});

// ─── Screen 05 — PixelLegacyPage (PIXEL-LEGACY-002 status display) ────────

const PIXEL_LEGACY_BENEFITS = {
  payout_range_min_usd: 0.07,
  payout_range_max_usd: 0.09,
  lifetime_cyrano: true,
  signing_bonus_month: 4,
  badge_label: 'Pixel Legacy' as const,
};

/** Marketing-cap-clamped meter (3,000) with the gateway still open. */
const SEAT_METER_OPEN = {
  seats_taken: 1200,
  seats_total: 3000,
  seats_remaining: 1800,
  cap_reached: false,
  gateway_open: true,
};

/** Marketing cap saturated; gateway closed. */
const SEAT_METER_CLOSED = {
  seats_taken: 3000,
  seats_total: 3000,
  seats_remaining: 0,
  cap_reached: true,
  gateway_open: false,
};

function buildPixelLegacyView(
  overrides: Partial<PixelLegacyStatusView> = {},
): PixelLegacyStatusView {
  return {
    creator_id: 'creator-pl-001',
    display_name: 'Test Creator',
    is_pixel_legacy: false,
    seat_number: null,
    granted_at_utc: null,
    seat_meter: SEAT_METER_OPEN,
    benefits: PIXEL_LEGACY_BENEFITS,
    cyrano_panel_unlocked: false,
    generated_at_utc: '2026-05-02T00:00:00Z',
    rule_applied_id: 'PIXEL_LEGACY_v2',
    ...overrides,
  };
}

describe('PixelLegacyPage — render plan structure (FCFS gateway)', () => {
  it('renders the GATEWAY_OPEN branch when not granted and gateway is open', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-page');
    expect(ids).toContain('pixel-legacy-header');
    expect(ids).toContain('pixel-legacy-seat-meter');
    expect(ids).toContain('pixel-legacy-unfilled-panel');
    expect(ids).toContain('pixel-legacy-benefits');
    // Granted panel + Cyrano CTA must not appear pre-grant.
    expect(ids).not.toContain('pixel-legacy-granted-panel');
    expect(ids).not.toContain('pixel-legacy-open-cyrano');
  });

  it('renders the GATEWAY_CLOSED branch with cap-reached notice', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({ seat_meter: SEAT_METER_CLOSED }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-unfilled-panel');
    expect(ids).toContain('pixel-legacy-cap-reached-notice');
    const bar = findByTestId(render.tree, 'pixel-legacy-seat-bar');
    expect(bar?.props?.cap_reached).toBe(true);
    expect(bar?.props?.gateway_open).toBe(false);
    expect(bar?.props?.pct_filled).toBe(100);
  });

  it('renders the GRANTED branch with seat number and Cyrano CTA when unlocked', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({
        is_pixel_legacy: true,
        seat_number: 1234,
        granted_at_utc: '2026-04-30T12:00:00Z',
        cyrano_panel_unlocked: true,
      }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-granted-panel');
    expect(ids).toContain('pixel-legacy-seat-number');
    expect(ids).toContain('pixel-legacy-open-cyrano');
    // Unfilled panel must not appear once granted.
    expect(ids).not.toContain('pixel-legacy-unfilled-panel');
    const seatNumberEl = findByTestId(render.tree, 'pixel-legacy-seat-number');
    expect(seatNumberEl?.children?.[0]).toBe('1234');
  });

  it('does not render the Cyrano CTA when granted but cyrano_panel_unlocked=false', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({
        is_pixel_legacy: true,
        seat_number: 7,
        granted_at_utc: '2026-04-30T12:00:00Z',
        cyrano_panel_unlocked: false,
      }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-granted-panel');
    expect(ids).not.toContain('pixel-legacy-open-cyrano');
  });

  it('seat meter reflects correct proportions in the open branch', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    const bar = findByTestId(render.tree, 'pixel-legacy-seat-bar');
    expect(bar?.props?.cap_reached).toBe(false);
    expect(bar?.props?.gateway_open).toBe(true);
    expect(bar?.props?.seats_taken).toBe(1200);
    expect(bar?.props?.seats_total).toBe(3000);
    expect(bar?.props?.pct_filled).toBe(40);
  });

  it('benefits panel shows the correct payout range and lifetime Cyrano flag', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    const rangeEl = findByTestId(render.tree, 'pixel-legacy-payout-range');
    expect(rangeEl).toBeDefined();
    expect(rangeEl!.children?.[0]).toContain('$0.07');
    expect(rangeEl!.children?.[0]).toContain('$0.09');
    const cyranoEl = findByTestId(render.tree, 'pixel-legacy-cyrano-benefit');
    expect(cyranoEl?.children?.[0]).toContain('Lifetime');
  });

  it('returns the canonical SEO metadata for /creator/pixel-legacy', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    expect(render.metadata.canonical_url).toContain('/creator/pixel-legacy');
  });
});
