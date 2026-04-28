// Screen 04 — /vip/membership Membership Lifecycle View (VIP Member).
// Role: VIP (all sub-tiers — VIP through VIP_DIAMOND).
// Purpose: Track membership status, renewal, recovery options.
//
// Presenter binding: MembershipPresenter.buildView()
// States handled: ACTIVE | EXPIRING | EXPIRED | RECOVERED
//
// Layout (top → bottom):
//   1. Tier badge (VIP_PLATINUM / VIP_DIAMOND / …)
//   2. Status banner ("Expires in 48h" | "Active until {date}")
//   3. Recovery options (Token Bridge · Three-Fifths Exit · Top-up CZT)
//   4. FFS heat history sparkline
//   5. Recovery confirmation modal (step-up if policy-gated)

import {
  MembershipPresenter,
  type MembershipPresenterInputs,
} from '../../../view-models/membership.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  FfsHeatPoint,
  MembershipLifecycleView,
  ThreeFifthsExitOfferCard,
  TokenBridgeOfferCard,
  TopUpCztSummary,
  VipTier,
  VIP_TIER_LABEL,
} from '../../../types/membership-lifecycle-contracts';

// Import the label map at runtime — it is a const object, not a type.
import { VIP_TIER_LABEL as TIER_LABEL } from '../../../types/membership-lifecycle-contracts';

export const MEMBERSHIP_PAGE_RULE_ID = 'MEMBERSHIP_LIFECYCLE_PAGE_v1';

export interface MembershipPageRender {
  metadata: typeof SEO.vip_membership;
  view: MembershipLifecycleView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderMembershipPage(inputs: MembershipPresenterInputs): MembershipPageRender {
  const presenter = new MembershipPresenter();
  const view = presenter.buildView(inputs);

  const tree = el(
    'main',
    {
      test_id: 'membership-page',
      classes: ['cnz-membership', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, status: view.status },
      aria: { 'aria-label': 'VIP Membership status' },
    },
    [
      renderTierBadge(view),
      renderStatusBanner(view),
      renderRecoveryOptions(view),
      renderHeatSparkline(view.ffs_heat_history),
      renderRecoveryModal(),
    ],
  );

  return {
    metadata: SEO.vip_membership,
    view,
    tree,
    rule_applied_id: MEMBERSHIP_PAGE_RULE_ID,
  };
}

// ─── Tier badge ────────────────────────────────────────────────────────────

function renderTierBadge(view: MembershipLifecycleView): RenderElement {
  const label = TIER_LABEL[view.tier];
  return el(
    'header',
    {
      test_id: 'membership-tier-header',
      classes: ['cnz-membership__header'],
      aria: { 'aria-label': `Membership tier: ${label}` },
    },
    [
      el(
        'span',
        {
          test_id: 'membership-tier-badge',
          classes: ['cnz-tier-badge', `cnz-tier-badge--${view.tier.toLowerCase()}`],
          props: { tier: view.tier },
        },
        [label],
      ),
      el(
        'span',
        {
          test_id: 'membership-active-since',
          classes: ['cnz-membership__since'],
        },
        [`Member since ${view.active_since_utc.slice(0, 10)}`],
      ),
    ],
  );
}

// ─── Status banner ─────────────────────────────────────────────────────────

function resolveStatusBannerCopy(view: MembershipLifecycleView): string {
  switch (view.status) {
    case 'ACTIVE':
      return view.expires_at_utc
        ? `Active until ${view.expires_at_utc.slice(0, 10)}`
        : 'Active — no expiry (permanent VIP)';
    case 'EXPIRING':
      return view.hours_until_expiry !== null
        ? `Expires in ${Math.ceil(view.hours_until_expiry)}h`
        : 'Expiring soon';
    case 'EXPIRED':
      return 'Membership expired — choose a recovery option below';
    case 'RECOVERED':
      return `Membership recovered — active until ${view.expires_at_utc?.slice(0, 10) ?? '—'}`;
  }
}

function statusBannerClass(view: MembershipLifecycleView): string {
  switch (view.status) {
    case 'ACTIVE':
      return 'cnz-membership__banner--active';
    case 'EXPIRING':
      return 'cnz-membership__banner--expiring';
    case 'EXPIRED':
      return 'cnz-membership__banner--expired';
    case 'RECOVERED':
      return 'cnz-membership__banner--recovered';
  }
}

function renderStatusBanner(view: MembershipLifecycleView): RenderElement {
  const copy = resolveStatusBannerCopy(view);
  const bannerClass = statusBannerClass(view);
  return el(
    'section',
    {
      test_id: 'membership-status-banner',
      classes: ['cnz-membership__banner', bannerClass],
      props: {
        status: view.status,
        nats_warning_received: view.nats_warning_received,
      },
      aria: { role: 'status', 'aria-live': 'polite', 'aria-label': copy },
    },
    [
      el('p', { test_id: 'membership-status-copy' }, [copy]),
      view.nats_warning_received
        ? el(
            'span',
            {
              test_id: 'membership-nats-warning-flag',
              classes: ['cnz-membership__nats-badge'],
            },
            ['⚡ Real-time warning received'],
          )
        : null,
    ].filter(Boolean) as RenderElement[],
  );
}

// ─── Recovery options ──────────────────────────────────────────────────────

function renderRecoveryOptions(view: MembershipLifecycleView): RenderElement {
  const isRecoverable = view.status === 'EXPIRING' || view.status === 'EXPIRED';

  if (!isRecoverable) {
    return el(
      'section',
      {
        test_id: 'membership-recovery-options',
        classes: ['cnz-panel', 'cnz-panel--recovery', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Recovery options (not available in current status)' },
      },
      [
        el('p', {}, [
          view.status === 'RECOVERED'
            ? 'Your membership has been recovered — no further action needed.'
            : 'No recovery options available while membership is active.',
        ]),
      ],
    );
  }

  return el(
    'section',
    {
      test_id: 'membership-recovery-options',
      classes: ['cnz-panel', 'cnz-panel--recovery'],
      aria: { 'aria-label': 'Membership recovery options' },
    },
    [
      el('h2', {}, ['Recovery options']),
      view.token_bridge_offer
        ? renderTokenBridgeCard(view.token_bridge_offer)
        : null,
      view.three_fifths_exit_offer
        ? renderThreeFifthsCard(view.three_fifths_exit_offer)
        : null,
      renderTopUpCard(view.top_up_summary),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderTokenBridgeCard(offer: TokenBridgeOfferCard): RenderElement {
  return el(
    'article',
    {
      test_id: 'membership-token-bridge-card',
      classes: ['cnz-cta-card', 'cnz-cta-card--token-bridge'],
      props: { rule_applied_id: offer.rule_applied_id },
    },
    [
      el('h3', {}, ['Token Bridge']),
      el('p', {}, [
        `Keep your tokens and receive a ${(offer.bonus_pct * 100).toFixed(0)}% bonus (${offer.bonus_tokens} CZT). ` +
          `Tokens are restricted for ${offer.restriction_window_hours}h after bridging.`,
      ]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Bonus tokens']),
        el('dd', { test_id: 'membership-bridge-bonus-tokens' }, [offer.bonus_tokens]),
        el('dt', {}, ['Restriction window']),
        el('dd', {}, [`${offer.restriction_window_hours}h`]),
        el('dt', {}, ['One-time waiver']),
        el('dd', {}, [offer.waiver_eligible ? 'Eligible' : 'Already used this year']),
      ]),
      el(
        'button',
        {
          test_id: 'membership-token-bridge-accept',
          classes: ['cnz-button', 'cnz-button--primary'],
          on: { click: 'openRecoveryModal' },
          props: { action: 'TOKEN_BRIDGE', rule_applied_id: offer.rule_applied_id },
        },
        ['Accept Token Bridge'],
      ),
    ],
  );
}

function renderThreeFifthsCard(offer: ThreeFifthsExitOfferCard): RenderElement {
  return el(
    'article',
    {
      test_id: 'membership-three-fifths-card',
      classes: [
        'cnz-cta-card',
        offer.policy_gated ? 'cnz-cta-card--policy-gated' : 'cnz-cta-card--armed',
      ],
      props: {
        policy_gated: offer.policy_gated,
        rule_applied_id: offer.rule_applied_id,
      },
    },
    [
      el('h3', {}, ['Three-Fifths Exit']),
      el('p', {}, [
        `Receive a ${(offer.refund_pct * 100).toFixed(0)}% cash refund on your remaining balance. ` +
          `A ${offer.lock_hours}h account hold applies after processing.`,
        offer.policy_gated ? ' Requires platform approval.' : '',
      ]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Estimated refund']),
        el('dd', { test_id: 'membership-three-fifths-refund-estimate' }, [
          `${offer.estimated_refund_usd_cents} cents`,
        ]),
        el('dt', {}, ['Lock period']),
        el('dd', {}, [`${offer.lock_hours}h`]),
      ]),
      el(
        'button',
        {
          test_id: 'membership-three-fifths-accept',
          classes: [
            'cnz-button',
            offer.policy_gated ? 'cnz-button--disabled' : 'cnz-button--danger',
          ],
          on: { click: 'openRecoveryModal' },
          props: {
            action: 'THREE_FIFTHS_EXIT',
            disabled: offer.policy_gated,
            rule_applied_id: offer.rule_applied_id,
          },
        },
        [offer.policy_gated ? 'Requires platform approval' : 'Request Three-Fifths Exit'],
      ),
    ],
  );
}

function renderTopUpCard(summary: TopUpCztSummary): RenderElement {
  return el(
    'article',
    {
      test_id: 'membership-top-up-card',
      classes: ['cnz-cta-card', 'cnz-cta-card--top-up'],
    },
    [
      el('h3', {}, ['Top-up CZT']),
      el('p', {}, [
        'Purchase additional CZT tokens to renew your membership. ' +
          `Your tier stipend is ${summary.tier_stipend_czt} CZT/month.`,
      ]),
      el(
        'dl',
        { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] },
        [
          el('dt', {}, ['Total balance']),
          el('dd', { test_id: 'membership-top-up-total' }, [summary.total_tokens]),
          ...summary.buckets.flatMap((b) => [
            el('dt', {}, [`${b.bucket} (priority ${b.spend_priority})`]),
            el(
              'dd',
              {
                test_id: `membership-top-up-bucket-${b.bucket}`,
                props: { spend_priority: b.spend_priority },
              },
              [b.balance_tokens],
            ),
          ]),
        ],
      ),
      el(
        'button',
        {
          test_id: 'membership-top-up-cta',
          classes: ['cnz-button', 'cnz-button--primary'],
          on: { click: 'navigateToTokenPurchase' },
          props: { action: 'TOP_UP_CZT' },
        },
        ['Purchase CZT Tokens'],
      ),
    ],
  );
}

// ─── FFS heat sparkline ────────────────────────────────────────────────────

function renderHeatSparkline(history: FfsHeatPoint[]): RenderElement {
  if (history.length === 0) {
    return el(
      'section',
      {
        test_id: 'membership-heat-sparkline',
        classes: ['cnz-panel', 'cnz-panel--sparkline', 'cnz-panel--empty'],
        aria: { 'aria-label': 'FFS heat history sparkline (no session data)' },
      },
      [el('p', {}, ['No session heat history available yet.'])],
    );
  }

  return el(
    'section',
    {
      test_id: 'membership-heat-sparkline',
      classes: ['cnz-panel', 'cnz-panel--sparkline'],
      aria: { 'aria-label': 'FFS heat history sparkline' },
    },
    [
      el('h2', {}, ['Your heat history']),
      el(
        'div',
        {
          test_id: 'membership-heat-sparkline-chart',
          classes: ['cnz-sparkline'],
          props: {
            // Serialise as JSON-safe array so the renderer can hydrate the chart.
            data_points: history.map((p) => ({
              t: p.captured_at_utc,
              v: p.score,
              tier: p.tier,
            })),
            point_count: history.length,
          },
          aria: {
            role: 'img',
            'aria-label': `Heat score sparkline — ${history.length} data points. Latest score: ${history[0].score} (${history[0].tier})`,
          },
        },
        // Fallback text for non-JS renderers.
        history.slice(0, 5).map((p) =>
          el(
            'span',
            {
              test_id: `membership-heat-point-${p.captured_at_utc}`,
              classes: [`cnz-sparkline__point--${p.tier.toLowerCase()}`],
              props: { score: p.score, tier: p.tier },
            },
            [`${p.score}`],
          ),
        ),
      ),
    ],
  );
}

// ─── Recovery confirmation modal ───────────────────────────────────────────

function renderRecoveryModal(): RenderElement {
  return el(
    'div',
    {
      test_id: 'membership-recovery-modal',
      classes: ['cnz-modal', 'cnz-modal--hidden'],
      aria: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Recovery confirmation',
      },
      props: { open: false },
    },
    [
      el('header', { classes: ['cnz-modal__header'] }, [
        el('h2', { test_id: 'membership-recovery-modal-title' }, ['Confirm recovery action']),
        el(
          'button',
          {
            test_id: 'membership-recovery-modal-close',
            classes: ['cnz-modal__close', 'cnz-button', 'cnz-button--ghost'],
            on: { click: 'closeRecoveryModal' },
            aria: { 'aria-label': 'Close recovery modal' },
          },
          ['×'],
        ),
      ]),
      el('div', { test_id: 'membership-recovery-modal-body', classes: ['cnz-modal__body'] }, [
        el('p', { test_id: 'membership-recovery-modal-quote' }, [
          'Confirm your selection. This action is recorded and audited.',
        ]),
        el(
          'div',
          {
            test_id: 'membership-step-up-prompt',
            classes: ['cnz-modal__step-up', 'cnz-modal--hidden'],
            aria: { 'aria-label': 'Step-up authentication required' },
          },
          [
            el('p', {}, [
              'This action requires additional verification. ' +
                'Please complete the step-up challenge to proceed.',
            ]),
            el(
              'button',
              {
                test_id: 'membership-step-up-trigger',
                classes: ['cnz-button', 'cnz-button--primary'],
                on: { click: 'triggerStepUpChallenge' },
              },
              ['Verify identity'],
            ),
          ],
        ),
      ]),
      el('footer', { classes: ['cnz-modal__footer'] }, [
        el(
          'button',
          {
            test_id: 'membership-recovery-modal-confirm',
            classes: ['cnz-button', 'cnz-button--danger'],
            on: { click: 'confirmRecoveryAction' },
            props: { action: null },
          },
          ['Confirm'],
        ),
        el(
          'button',
          {
            test_id: 'membership-recovery-modal-cancel',
            classes: ['cnz-button', 'cnz-button--ghost'],
            on: { click: 'closeRecoveryModal' },
          },
          ['Cancel'],
        ),
      ]),
    ],
  );
}
