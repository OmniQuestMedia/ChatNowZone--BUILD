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

// ─── Screen 04 — MembershipPresenter ──────────────────────────────────────

import {
  MembershipPresenter,
  DEFAULT_MEMBERSHIP_GOVERNANCE,
} from '../../ui/view-models/membership.presenter';
import { renderMembershipPage } from '../../ui/app/vip/membership/page';

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
      ffs_heat_history: [
        { captured_at_utc: '2026-04-01T00:00:00Z', score: 80, tier: 'HOT' },
      ],
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

// ─── Screen 05 — PixelLegacyPage ──────────────────────────────────────────

import { renderPixelLegacyPage } from '../../ui/app/creator/pixel-legacy/page';
import type { PixelLegacyApplicationView } from '../../ui/types/creator-panel-contracts';

const PIXEL_LEGACY_BENEFITS = {
  payout_range_min_usd: 0.07,
  payout_range_max_usd: 0.09,
  lifetime_cyrano: true,
  signing_bonus_month: 4,
  badge_label: 'Pixel Legacy' as const,
};

const PIXEL_LEGACY_SEAT_METER = {
  seats_taken: 1200,
  seats_total: 3500,
  seats_remaining: 2300,
  cap_reached: false,
};

function buildPixelLegacyView(
  overrides: Partial<PixelLegacyApplicationView> = {},
): PixelLegacyApplicationView {
  return {
    application_id: null,
    creator_id: 'creator-pl-001',
    display_name: 'Test Creator',
    status: 'DRAFT',
    seat_meter: PIXEL_LEGACY_SEAT_METER,
    portfolio_entries: [],
    proof_statement: '',
    submitted_at_utc: null,
    reviewed_at_utc: null,
    denial_reason_code: null,
    benefits: PIXEL_LEGACY_BENEFITS,
    cyrano_panel_unlocked: false,
    generated_at_utc: '2026-04-28T00:00:00Z',
    rule_applied_id: 'PIXEL_LEGACY_PAGE_v1',
    ...overrides,
  };
}

describe('PixelLegacyPage — render plan structure', () => {
  it('renders all core sections in DRAFT state', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-page');
    expect(ids).toContain('pixel-legacy-header');
    expect(ids).toContain('pixel-legacy-status-tracker');
    expect(ids).toContain('pixel-legacy-seat-meter');
    expect(ids).toContain('pixel-legacy-benefits');
    expect(ids).toContain('pixel-legacy-application-form');
    expect(ids).toContain('pixel-legacy-submit');
  });

  it('shows the DENIED state node when status is DENIED', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({ status: 'DENIED', denial_reason_code: 'SEAT_CAP_REACHED' }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-status-denied');
    expect(ids).not.toContain('pixel-legacy-step-applied');
  });

  it('renders the granted panel and Cyrano CTA when GRANTED + unlocked', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({
        application_id: 'app-granted-001',
        status: 'GRANTED',
        cyrano_panel_unlocked: true,
        reviewed_at_utc: '2026-04-20T00:00:00Z',
      }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-granted-panel');
    expect(ids).toContain('pixel-legacy-open-cyrano');
    expect(ids).toContain('pixel-legacy-application-id');
    // Form submit button must not appear after grant
    expect(ids).not.toContain('pixel-legacy-submit');
  });

  it('seat meter reflects correct proportions', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({
        seat_meter: { seats_taken: 3500, seats_total: 3500, seats_remaining: 0, cap_reached: true },
      }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-cap-reached-notice');
    const bar = findByTestId(render.tree, 'pixel-legacy-seat-bar');
    expect(bar?.props?.cap_reached).toBe(true);
    expect(bar?.props?.pct_filled).toBe(100);
  });

  it('renders portfolio entries when present', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({
        portfolio_entries: [
          { entry_id: 'e-1', label: 'Twitch', url: 'https://twitch.tv/example' },
          { entry_id: 'e-2', label: 'YouTube', url: 'https://youtube.com/example' },
        ],
      }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-portfolio-e-1');
    expect(ids).toContain('pixel-legacy-portfolio-e-2');
    expect(ids).toContain('pixel-legacy-add-portfolio-entry');
  });

  it('benefits preview shows correct payout range', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    const rangeEl = findByTestId(render.tree, 'pixel-legacy-payout-range');
    expect(rangeEl).toBeDefined();
    expect(rangeEl!.children?.[0]).toContain('$0.07');
    expect(rangeEl!.children?.[0]).toContain('$0.09');
  });

  it('returns noindex SEO metadata', () => {
    const render = renderPixelLegacyPage({ view: buildPixelLegacyView() });
    expect(render.metadata.robots).toBe('noindex,nofollow');
    expect(render.metadata.canonical_url).toContain('/creator/pixel-legacy');
  });

  it('status tracker shows APPLIED / REVIEWED / GRANTED steps', () => {
    const render = renderPixelLegacyPage({
      view: buildPixelLegacyView({ status: 'REVIEWED' }),
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('pixel-legacy-step-applied');
    expect(ids).toContain('pixel-legacy-step-reviewed');
    expect(ids).toContain('pixel-legacy-step-granted');
  });
});
