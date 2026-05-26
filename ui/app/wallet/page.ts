// PAYLOAD 7 — /wallet three-bucket wallet page.
// Core Surface 01 — Public Wallet View.
// Extends the base wallet render with page states, tier badge, purchase CTAs,
// FFS Inferno hint, recent ledger, Welfare Guardian bands, and Bill 149 overlay.

import {
  PublicWalletPresenter,
  type GovernanceSnapshot,
} from '../../view-models/public-wallet.presenter';
import { SEO } from '../../config/seo';
import { THEME } from '../../config/theme';
import { el, RenderElement } from '../../components/render-plan';
import type {
  Bill149OverlayProps,
  FfsBandHint,
  GuestTier,
  PublicWalletViewState,
  SafetyNetOfferCard,
  TierBadgeProps,
  WalletBucket,
  WalletLedgerEntry,
  WalletThreeBucketView,
  WelfareGuardianBand,
} from '../../types/public-wallet-contracts';

export const WALLET_PAGE_RULE_ID = 'WALLET_PAGE_v1';

/** Bill 149 canonical disclosure text (AI-generated content). */
const BILL_149_DISCLOSURE =
  'This platform uses AI-generated suggestions. Content may not reflect the views of any individual. ' +
  'Interactions with AI characters are for entertainment purposes only.';

const SYNTHIMATE_ORIGINALITY_WARNING =
  'All SynthiMates are original creations. Real-person likenesses are prohibited.';

export interface WalletPageRender {
  metadata: typeof SEO.wallet;
  view: WalletThreeBucketView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderWalletPage(args: {
  wallet_id: string;
  user_id: string;
  tier: GuestTier;
  balances: Record<WalletBucket, bigint>;
  safety_net?: SafetyNetOfferCard | null;
  governance?: GovernanceSnapshot;
  now_utc?: Date;
  // Core Surface 01 extensions (all optional for backward compat)
  state?: PublicWalletViewState;
  is_vip_diamond?: boolean;
  concierge_flag?: boolean;
  welfare_score?: number; // 0..100; drives Welfare Guardian band colour
  ffs_hint?: FfsBandHint | null;
  recent_ledger?: WalletLedgerEntry[];
  bill_149_acknowledged?: boolean;
}): WalletPageRender {
  const presenter = new PublicWalletPresenter();
  const view = presenter.buildWalletView({
    wallet_id: args.wallet_id,
    user_id: args.user_id,
    tier: args.tier,
    balances: args.balances,
    safety_net: args.safety_net,
    governance: args.governance,
    now_utc: args.now_utc,
  });

  const state: PublicWalletViewState = args.state ?? 'SUCCESS';

  // ── State-aware rendering ────────────────────────────────────────────────
  if (state === 'LOADING') {
    return {
      metadata: SEO.wallet,
      view,
      tree: el(
        'main',
        {
          test_id: 'wallet-page',
          classes: ['cnz-public', 'cnz-public--wallet', 'cnz-theme-dark', 'cnz-state--loading'],
          props: { mode: THEME.default_mode, state },
          aria: { 'aria-label': 'Wallet — loading', 'aria-busy': 'true' },
        },
        [
          el('div', { test_id: 'wallet-loading-indicator', classes: ['cnz-spinner'] }, [
            'Loading wallet…',
          ]),
        ],
      ),
      rule_applied_id: WALLET_PAGE_RULE_ID,
    };
  }

  if (state === 'EMPTY') {
    return {
      metadata: SEO.wallet,
      view,
      tree: el(
        'main',
        {
          test_id: 'wallet-page',
          classes: ['cnz-public', 'cnz-public--wallet', 'cnz-theme-dark', 'cnz-state--empty'],
          props: { mode: THEME.default_mode, state },
          aria: { 'aria-label': 'Wallet — new account' },
        },
        [
          el('header', { classes: ['cnz-public__header'] }, [
            el('h1', {}, ['Wallet']),
            el('p', { test_id: 'wallet-empty-message' }, ['Welcome! Add tokens to get started.']),
          ]),
          renderCtaRow(),
        ],
      ),
      rule_applied_id: WALLET_PAGE_RULE_ID,
    };
  }

  if (state === 'WELFARE_GUARDIAN_PAUSE') {
    return {
      metadata: SEO.wallet,
      view,
      tree: el(
        'main',
        {
          test_id: 'wallet-page',
          classes: [
            'cnz-public',
            'cnz-public--wallet',
            'cnz-theme-dark',
            'cnz-state--welfare-pause',
          ],
          props: { mode: THEME.default_mode, state },
          aria: { 'aria-label': 'Wallet — Welfare Guardian pause active' },
        },
        [
          el(
            'section',
            {
              test_id: 'wallet-welfare-pause-overlay',
              classes: ['cnz-overlay', 'cnz-overlay--welfare'],
              aria: { role: 'alert', 'aria-live': 'assertive' },
              props: { reason_code: 'WELFARE_GUARDIAN_PAUSE' },
            },
            [
              el('h2', {}, ['Welfare Guardian — Pause Active']),
              el('p', {}, [
                'Spending has been temporarily paused by the Welfare Guardian. ' +
                  'Please take a break. You can resume shortly.',
              ]),
              el(
                'button',
                {
                  test_id: 'wallet-welfare-pause-dismiss',
                  classes: ['cnz-button', 'cnz-button--primary'],
                  on: { click: 'acknowledgeWelfarePause' },
                },
                ['Acknowledged — take me back'],
              ),
            ],
          ),
        ],
      ),
      rule_applied_id: WALLET_PAGE_RULE_ID,
    };
  }

  if (state === 'GATE_GUARD_DENY') {
    return {
      metadata: SEO.wallet,
      view,
      tree: el(
        'main',
        {
          test_id: 'wallet-page',
          classes: [
            'cnz-public',
            'cnz-public--wallet',
            'cnz-theme-dark',
            'cnz-state--gateguard-deny',
          ],
          props: { mode: THEME.default_mode, state },
          aria: { 'aria-label': 'Wallet — GateGuard transaction denied' },
        },
        [
          el(
            'section',
            {
              test_id: 'wallet-gateguard-deny-overlay',
              classes: ['cnz-overlay', 'cnz-overlay--danger'],
              aria: { role: 'alert', 'aria-live': 'assertive' },
              props: { reason_code: 'GATE_GUARD_DENY' },
            },
            [
              el('h2', {}, ['Transaction Declined']),
              el('p', {}, [
                'Your transaction could not be completed at this time. ' +
                  'Please contact support if you believe this is an error.',
              ]),
              el(
                'button',
                {
                  test_id: 'wallet-gateguard-deny-dismiss',
                  classes: ['cnz-button', 'cnz-button--ghost'],
                  on: { click: 'dismissGateGuardDeny' },
                },
                ['Return to wallet'],
              ),
            ],
          ),
        ],
      ),
      rule_applied_id: WALLET_PAGE_RULE_ID,
    };
  }

  // ── SUCCESS state — full wallet render ───────────────────────────────────
  const tierBadge = presenter.buildTierBadge({
    tier: args.tier,
    is_vip_diamond: args.is_vip_diamond ?? false,
    concierge_flag: args.concierge_flag ?? false,
  });
  const welfareBand: WelfareGuardianBand | null =
    args.welfare_score !== undefined
      ? presenter.resolveWelfareGuardianBand(args.welfare_score)
      : null;

  const safetyNetSection = view.safety_net
    ? renderSafetyNet(view.safety_net)
    : el(
        'section',
        {
          test_id: 'wallet-safety-net-empty',
          classes: ['cnz-panel', 'cnz-panel--empty'],
        },
        [el('p', {}, ['No expiring balances — safety-net inactive.'])],
      );

  const bill149Overlay = renderBill149Overlay({
    disclosure_text: BILL_149_DISCLOSURE,
    acknowledged: args.bill_149_acknowledged ?? false,
    rule_reference: 'BILL_149_DISCLOSURE_v1',
  });

  const tree = el(
    'main',
    {
      test_id: 'wallet-page',
      classes: ['cnz-public', 'cnz-public--wallet', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, tier: args.tier, state },
      aria: { 'aria-label': 'Wallet — three-bucket view' },
    },
    [
      el('header', { classes: ['cnz-public__header'] }, [
        renderTierBadge(tierBadge),
        el('h1', {}, ['Wallet']),
        el('p', { test_id: 'wallet-total-tokens' }, [`Total: ${view.total_tokens} CZT`]),
        welfareBand ? renderWelfareGuardianBand(welfareBand) : null,
        args.ffs_hint?.is_inferno ? renderFfsBandHint(args.ffs_hint) : null,
      ]),
      renderCtaRow(),
      el(
        'section',
        {
          test_id: 'wallet-buckets',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Three-bucket spend order' },
        },
        [
          el('h2', {}, ['Spend order (deterministic)']),
          el(
            'ol',
            { classes: ['cnz-bucket-list'] },
            view.buckets.map((b) =>
              el(
                'li',
                {
                  test_id: `wallet-bucket-${b.bucket}`,
                  classes: [b.will_drain_next ? 'cnz-bucket-list__item--draining' : ''],
                  props: {
                    spend_priority: b.spend_priority,
                    will_drain_next: b.will_drain_next,
                  },
                },
                [
                  el('header', {}, [
                    el('strong', {}, [`${b.spend_priority}. ${b.label}`]),
                    el('span', {}, [`${b.balance_tokens} CZT`]),
                  ]),
                  el('p', {}, [b.description]),
                ],
              ),
            ),
          ),
        ],
      ),
      safetyNetSection,
      renderRecentLedger(args.recent_ledger ?? []),
      bill149Overlay,
    ],
  );

  return {
    metadata: SEO.wallet,
    view,
    tree,
    rule_applied_id: WALLET_PAGE_RULE_ID,
  };
}

// ── Helper render functions ──────────────────────────────────────────────────

function renderTierBadge(badge: TierBadgeProps): RenderElement {
  return el(
    'span',
    {
      test_id: 'wallet-tier-badge',
      classes: [
        'cnz-tier-badge',
        `cnz-tier-badge--${badge.tier.toLowerCase()}`,
        badge.is_vip_diamond ? 'cnz-tier-badge--vip-diamond' : '',
        badge.concierge_flag ? 'cnz-tier-badge--concierge' : '',
      ].filter(Boolean),
      props: {
        tier: badge.tier,
        is_vip_diamond: badge.is_vip_diamond,
        concierge_flag: badge.concierge_flag,
      },
      aria: { 'aria-label': `Tier: ${badge.display_label}` },
    },
    [badge.display_label],
  );
}

/** Buy CZT and Top-up Cyrano action row — always rendered in SUCCESS/EMPTY. */
function renderCtaRow(): RenderElement {
  return el(
    'div',
    {
      test_id: 'wallet-cta-row',
      classes: ['cnz-cta-row', 'cnz-cta-row--primary'],
    },
    [
      el(
        'button',
        {
          test_id: 'wallet-buy-czt',
          classes: ['cnz-button', 'cnz-button--primary', 'cnz-button--revenue'],
          on: { click: 'navigateToBuyCzt' },
          aria: { 'aria-label': 'Buy CZT tokens' },
        },
        ['Buy CZT'],
      ),
      el(
        'button',
        {
          test_id: 'wallet-topup-cyrano',
          classes: ['cnz-button', 'cnz-button--secondary'],
          on: { click: 'navigateToTopUpCyrano' },
          aria: { 'aria-label': 'Top-up Cyrano credits' },
        },
        ['Top-up Cyrano'],
      ),
    ],
  );
}

/**
 * Welfare Guardian band — colour-coded status bar beneath the total.
 * Maps band to a CSS modifier so the renderer adapter applies the correct
 * palette token (accent_success / accent_warning / accent_danger).
 */
function renderWelfareGuardianBand(band: WelfareGuardianBand): RenderElement {
  const bandMod = band.toLowerCase();
  return el(
    'div',
    {
      test_id: 'wallet-welfare-band',
      classes: ['cnz-welfare-band', `cnz-welfare-band--${bandMod}`],
      aria: {
        role: 'status',
        'aria-label': `Welfare Guardian: ${band}`,
      },
      props: { band },
    },
    [el('span', { classes: ['cnz-welfare-band__label'] }, [`Welfare: ${band}`])],
  );
}

/** FFS Inferno ambient indicator — only shown when ffs_hint.is_inferno is true. */
function renderFfsBandHint(hint: FfsBandHint): RenderElement {
  return el(
    'span',
    {
      test_id: 'wallet-ffs-inferno-hint',
      classes: ['cnz-ffs-hint', 'cnz-ffs-hint--inferno'],
      aria: { 'aria-label': `Room heat: INFERNO (${hint.score}/100)` },
      props: {
        session_id: hint.session_id,
        ffs_score: hint.score,
        nats_topic: `cnz.ffs.session.${hint.session_id}`,
      },
    },
    ['🔥 INFERNO'],
  );
}

/** Recent ledger entries section — empty state rendered when no entries. */
function renderRecentLedger(entries: WalletLedgerEntry[]): RenderElement {
  if (entries.length === 0) {
    return el(
      'section',
      {
        test_id: 'wallet-recent-ledger',
        classes: ['cnz-panel', 'cnz-panel--ledger', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Recent ledger activity' },
      },
      [
        el('h2', {}, ['Recent activity']),
        el('p', { classes: ['cnz-panel__empty-msg'] }, ['No recent transactions.']),
      ],
    );
  }

  return el(
    'section',
    {
      test_id: 'wallet-recent-ledger',
      classes: ['cnz-panel', 'cnz-panel--ledger'],
      aria: { 'aria-label': 'Recent ledger activity' },
    },
    [
      el('h2', {}, [`Recent activity (${entries.length})`]),
      el('table', { classes: ['cnz-table', 'cnz-table--ledger'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Time']),
            el('th', {}, ['Description']),
            el('th', {}, ['Bucket']),
            el('th', {}, ['Amount (CZT)']),
            el('th', {}, ['Balance (CZT)']),
          ]),
        ]),
        el(
          'tbody',
          {},
          entries.map((e) =>
            el(
              'tr',
              {
                test_id: `wallet-ledger-${e.ledger_id}`,
                props: {
                  reason_code: e.reason_code,
                  correlation_id: e.correlation_id,
                },
                classes: [
                  e.amount_tokens.startsWith('-')
                    ? 'cnz-table__row--debit'
                    : 'cnz-table__row--credit',
                ],
              },
              [
                el('td', {}, [e.occurred_at_utc]),
                el('td', {}, [e.description]),
                el('td', {}, [e.bucket]),
                el('td', {}, [e.amount_tokens]),
                el('td', {}, [e.running_balance_tokens]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

/**
 * Bill 149 compliance disclosure overlay.
 * Rendered collapsed when already acknowledged; expanded otherwise.
 * Must appear whenever AI-generated content (Cyrano copy) is visible.
 */
function renderBill149Overlay(props: Bill149OverlayProps): RenderElement {
  return el(
    'aside',
    {
      test_id: 'wallet-bill149-overlay',
      classes: [
        'cnz-compliance-overlay',
        props.acknowledged ? 'cnz-compliance-overlay--dismissed' : 'cnz-compliance-overlay--active',
      ],
      aria: { role: 'complementary', 'aria-label': 'AI content disclosure (Bill 149)' },
      props: {
        rule_reference: props.rule_reference,
        acknowledged: props.acknowledged,
      },
    },
    [
      el('p', { classes: ['cnz-compliance-overlay__text'] }, [props.disclosure_text]),
      el('p', { classes: ['cnz-compliance-overlay__text', 'cnz-compliance-overlay__warning'] }, [
        SYNTHIMATE_ORIGINALITY_WARNING,
      ]),
      el(
        'button',
        {
          test_id: 'wallet-bill149-acknowledge',
          classes: ['cnz-button', 'cnz-button--ghost', 'cnz-button--sm'],
          on: { click: 'acknowledgeBill149' },
          props: { disabled: props.acknowledged },
        },
        [props.acknowledged ? 'Acknowledged' : 'Acknowledge'],
      ),
    ],
  );
}

function renderSafetyNet(net: SafetyNetOfferCard): RenderElement {
  return el(
    'section',
    {
      test_id: 'wallet-safety-net',
      classes: ['cnz-panel', 'cnz-panel--safety-net'],
      aria: { 'aria-label': 'Expiration safety net' },
      props: {
        wallet_id: net.wallet_id,
        rule_applied_id: net.rule_applied_id,
      },
    },
    [
      el('h2', {}, ['Safety net']),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Expires']),
        el('dd', {}, [net.expires_at_utc]),
        el('dt', {}, ['Hours until expiry']),
        el('dd', {}, [String(net.hours_until_expiry)]),
        el('dt', {}, ['Remaining tokens']),
        el('dd', {}, [net.remaining_tokens]),
        el('dt', {}, ['Extension fee']),
        el('dd', {}, [`$${net.extension_fee_usd.toFixed(2)} for +${net.extension_grant_days}d`]),
        el('dt', {}, ['Recovery fee']),
        el('dd', {}, [`$${net.recovery_fee_usd.toFixed(2)}`]),
        el('dt', {}, ['3/5ths refund pct']),
        el('dd', {}, [`${(net.three_fifths_refund_pct * 100).toFixed(0)}%`]),
        el('dt', {}, ['3/5ths lock']),
        el('dd', {}, [`${net.three_fifths_lock_hours}h`]),
      ]),
      el('div', { classes: ['cnz-cta-row'] }, [
        el(
          'button',
          {
            test_id: 'wallet-safety-net-extend',
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: 'requestExtension' },
          },
          [`Extend $${net.extension_fee_usd.toFixed(2)}`],
        ),
        el(
          'button',
          {
            test_id: 'wallet-safety-net-recover',
            classes: ['cnz-button', 'cnz-button--secondary'],
            on: { click: 'requestRecovery' },
          },
          [`Recover $${net.recovery_fee_usd.toFixed(2)}`],
        ),
        net.has_token_bridge_eligible
          ? el(
              'button',
              {
                test_id: 'wallet-safety-net-token-bridge',
                classes: ['cnz-button', 'cnz-button--ghost'],
                on: { click: 'requestTokenBridge' },
              },
              [`Token Bridge +${(net.token_bridge_bonus_pct * 100).toFixed(0)}%`],
            )
          : null,
      ]),
    ],
  );
}
