// PAYLOAD 7 — /admin/diamond Diamond Concierge Command Center page.
// Core Surface 03 — Diamond Concierge Operator View.
// Extends the existing command center with:
//   • High-heat VIP_DIAMOND queue (INFERNO FFS detections, separate from 48h expiry queue)
//   • Operator Quote Generator (volume + velocity + $0.077 floor, step-up auth gated)
//
// Surfaces (top → bottom):
//   1. KPI strip (5 cards)
//   2. Real-time liquidity panel (volume + velocity)
//   3. 48h warning queue
//   4. High-balance personal-touch queue
//   5. High-heat VIP_DIAMOND queue (new)
//   6. Operator Quote Generator (new)
//   7. Token Bridge one-click cards (Pillar 1)
//   8. Three-Fifths Exit one-click cards (Pillar 2 — policy-gated)
//   9. GateGuard live telemetry feed
//  10. Welfare Guardian live panel
//  11. Audit chain viewer (window of immutable events)

import {
  DiamondConciergePresenter,
  type DiamondCommandCenterInputs,
} from '../../../view-models/diamond-concierge.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { kpiAriaLabel } from '../../../config/accessibility';
import { el, RenderElement, RenderNode } from '../../../components/render-plan';
import type {
  DiamondCommandCenterView,
  DiamondKpiCard,
  HighHeatVipRow,
  OperatorQuoteDisplay,
  OperatorQuoteInput,
} from '../../../types/admin-diamond-contracts';

/* ── HANDOFF ──────────────────────────────────────────────────────────────
 * All major surfaces are now Canonical-compliant:
 *   • REDBOOK-locked liquidity table sourced from DiamondConciergePresenter.
 *   • Recovery flows (Token Bridge, 3/5ths Exit) wired to RecoveryEngine
 *     RecoveryEngine.tokenBridgeOffer / threeFifthsExit.
 *   • Welfare Guardian Score live panel composes WELFARE_GUARDIAN_v1.
 *   • Audit chain viewer renders immutable AUDIT_IMMUTABLE_* events.
 *   • High-heat VIP_DIAMOND queue surfaces INFERNO sessions for handoff.
 *   • Operator Quote Generator: step-up auth gated, $0.077 floor enforced.
 * The platform is functionally complete for internal alpha.
 * Next (final): End-to-end validation + deployment prep (PAYLOAD 8).
 * ──────────────────────────────────────────────────────────────────────── */

export const DIAMOND_PAGE_RULE_ID = 'ADMIN_DIAMOND_PAGE_v1';

export interface DiamondPageRender {
  metadata: typeof SEO.admin_diamond;
  view: DiamondCommandCenterView;
  tree: RenderElement;
  test_ids: readonly string[];
  rule_applied_id: string;
}

export function renderDiamondPage(
  inputs: DiamondCommandCenterInputs & {
    /** High-heat VIP_DIAMOND sessions detected at INFERNO FFS tier. */
    high_heat_vip_rows?: HighHeatVipRow[];
    /** Pre-computed operator quote to display, or null when no active input. */
    operator_quote?: OperatorQuoteDisplay | null;
    /** Inputs for the operator quote form (drives populated/empty state). */
    operator_quote_input?: OperatorQuoteInput | null;
  },
): DiamondPageRender {
  const presenter = new DiamondConciergePresenter();
  const view = presenter.buildCommandCenterView(inputs);

  const highHeatVipRows = presenter.buildHighHeatVipQueue(inputs.high_heat_vip_rows ?? []);

  const kpiStrip = renderKpiStrip(view.liquidity.kpis);
  const liquidityPanel = renderLiquidityPanel(view);
  const warningQueue = renderWarningQueue(view);
  const personalTouchQueue = renderPersonalTouchQueue(view);
  const highHeatVipPanel = renderHighHeatVipQueue(highHeatVipRows);
  const operatorQuotePanel = renderOperatorQuoteGenerator(
    inputs.operator_quote_input ?? null,
    inputs.operator_quote ?? null,
  );
  const tokenBridgeCards = renderTokenBridgeCards(view);
  const threeFifthsCards = renderThreeFifthsCards(view);
  const gateGuardFeed = renderGateGuardFeed(view);
  const welfarePanel = renderWelfarePanel(view);
  const auditChain = renderAuditChain(view);

  const tree = el(
    'main',
    {
      test_id: 'admin-diamond-page',
      aria: { 'aria-label': 'Diamond Concierge command center' },
      classes: ['cnz-admin', 'cnz-admin--diamond', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode },
    },
    [
      el(
        'header',
        {
          test_id: 'admin-diamond-header',
          classes: ['cnz-admin__header'],
        },
        [
          el('h1', { test_id: 'admin-diamond-title' }, ['Diamond Concierge']),
          el('p', { classes: ['cnz-admin__subtitle'] }, [
            'Real-time liquidity, recovery flows, and welfare telemetry.',
          ]),
        ],
      ),
      kpiStrip,
      liquidityPanel,
      warningQueue,
      personalTouchQueue,
      highHeatVipPanel,
      operatorQuotePanel,
      tokenBridgeCards,
      threeFifthsCards,
      gateGuardFeed,
      welfarePanel,
      auditChain,
    ],
  );

  const test_ids = ['admin-diamond-page'];
  return {
    metadata: SEO.admin_diamond,
    view,
    tree,
    test_ids,
    rule_applied_id: DIAMOND_PAGE_RULE_ID,
  };
}

function renderKpiStrip(cards: DiamondKpiCard[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-kpi-strip',
      classes: ['cnz-kpi-strip'],
      aria: { role: 'list', 'aria-label': 'Diamond key performance indicators' },
    },
    cards.map((c, idx) =>
      el(
        'article',
        {
          test_id: `admin-diamond-kpi-${idx}`,
          classes: ['cnz-kpi-card', `cnz-kpi-card--${c.trend.toLowerCase()}`],
          aria: {
            role: 'listitem',
            'aria-label': kpiAriaLabel(c.label, c.value, c.trend),
          },
          props: { reason_code: c.reason_code },
        },
        [
          el('span', { classes: ['cnz-kpi-card__label'] }, [c.label]),
          el('strong', { classes: ['cnz-kpi-card__value'] }, [c.value]),
          el('span', { classes: ['cnz-kpi-card__trend'] }, [c.trend]),
        ],
      ),
    ),
  );
}

function renderLiquidityPanel(view: DiamondCommandCenterView): RenderElement {
  const rows: RenderNode[] = view.liquidity.velocity_table.map((r) =>
    el(
      'tr',
      {
        test_id: `admin-diamond-velocity-${r.velocity_band}`,
        props: { reason_code: 'DIAMOND_VELOCITY_TABLE' },
      },
      [
        el('td', {}, [r.velocity_band]),
        el('td', {}, [String(r.open_wallets)]),
        el('td', {}, [r.remaining_tokens]),
        el('td', {}, [r.remaining_usd_cents]),
        el('td', {}, [`${r.pct_of_book.toFixed(2)}%`]),
      ],
    ),
  );
  return el(
    'section',
    {
      test_id: 'admin-diamond-liquidity',
      classes: ['cnz-panel', 'cnz-panel--liquidity'],
      aria: { 'aria-label': 'Diamond liquidity by velocity band' },
    },
    [
      el('h2', {}, ['Liquidity by velocity']),
      el('table', { classes: ['cnz-table'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Velocity']),
            el('th', {}, ['Open wallets']),
            el('th', {}, ['Tokens']),
            el('th', {}, ['USD cents']),
            el('th', {}, ['% of book']),
          ]),
        ]),
        el('tbody', {}, rows),
      ]),
    ],
  );
}

function renderWarningQueue(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-warning-queue',
      classes: ['cnz-panel', 'cnz-panel--warning-queue'],
      aria: { 'aria-label': '48-hour expiry warning queue' },
    },
    [
      el('h2', {}, [`Expiring in 48h (${view.warning_queue.length})`]),
      el(
        'ul',
        { classes: ['cnz-list'] },
        view.warning_queue.map((row) =>
          el(
            'li',
            {
              test_id: `admin-diamond-warning-${row.wallet_id}`,
              classes: [`cnz-list__item--${row.severity.toLowerCase()}`],
              props: { severity: row.severity },
            },
            [
              el('span', {}, [row.user_id]),
              el('span', {}, [`${row.hours_until_expiry}h left`]),
              el('span', {}, [`${row.remaining_tokens} CZT`]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderPersonalTouchQueue(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-personal-touch',
      classes: ['cnz-panel', 'cnz-panel--personal-touch'],
      aria: { 'aria-label': 'High-balance concierge queue' },
    },
    [
      el('h2', {}, [`High-balance concierge (${view.personal_touch_queue.length})`]),
      el(
        'ul',
        { classes: ['cnz-list'] },
        view.personal_touch_queue.map((row) =>
          el(
            'li',
            {
              test_id: `admin-diamond-touch-${row.wallet_id}`,
              classes: [`cnz-list__item--${row.escalation_tier.toLowerCase()}`],
              props: { escalation_tier: row.escalation_tier },
            },
            [
              el('span', {}, [row.user_id]),
              el('span', {}, [row.escalation_tier]),
              el('span', {}, [`${row.remaining_usd_cents} cents`]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderTokenBridgeCards(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-token-bridge',
      classes: ['cnz-panel', 'cnz-panel--token-bridge'],
      aria: { 'aria-label': 'Token Bridge one-click cards' },
    },
    [
      el('h2', {}, [`Token Bridge offers (${view.open_token_bridge_cards.length})`]),
      ...view.open_token_bridge_cards.map((card) =>
        el(
          'article',
          {
            test_id: `admin-diamond-bridge-${card.case_id}`,
            classes: ['cnz-cta-card'],
            props: { rule_applied_id: card.rule_applied_id },
          },
          [
            el('h3', {}, [`Case ${card.case_id}`]),
            el('dl', { classes: ['cnz-cta-card__meta'] }, [
              el('dt', {}, ['Bonus tokens']),
              el('dd', {}, [card.bonus_tokens]),
              el('dt', {}, ['Bonus pct']),
              el('dd', {}, [`${(card.bonus_pct * 100).toFixed(0)}%`]),
              el('dt', {}, ['Restriction window']),
              el('dd', {}, [`${card.restriction_window_hours}h`]),
            ]),
            el(
              'button',
              {
                test_id: `admin-diamond-bridge-accept-${card.case_id}`,
                classes: ['cnz-button', 'cnz-button--primary'],
                on: { click: 'acceptTokenBridge' },
                props: {
                  case_id: card.case_id,
                  requires_waiver_signature: card.requires_waiver_signature,
                },
              },
              ['Accept Token Bridge'],
            ),
          ],
        ),
      ),
    ],
  );
}

function renderThreeFifthsCards(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-three-fifths',
      classes: ['cnz-panel', 'cnz-panel--three-fifths'],
      aria: { 'aria-label': 'Three-Fifths Exit one-click cards' },
    },
    [
      el('h2', {}, [`Three-Fifths Exit (${view.open_three_fifths_cards.length})`]),
      ...view.open_three_fifths_cards.map((card) =>
        el(
          'article',
          {
            test_id: `admin-diamond-3-5-${card.case_id}`,
            classes: [
              'cnz-cta-card',
              card.policy_gated ? 'cnz-cta-card--policy-gated' : 'cnz-cta-card--armed',
            ],
            props: {
              policy_gated: card.policy_gated,
              policy_gate_reference: card.policy_gate_reference,
              rule_applied_id: card.rule_applied_id,
            },
          },
          [
            el('h3', {}, [`Case ${card.case_id}`]),
            el('dl', { classes: ['cnz-cta-card__meta'] }, [
              el('dt', {}, ['Refund %']),
              el('dd', {}, [`${(card.refund_percentage * 100).toFixed(0)}%`]),
              el('dt', {}, ['Lock hours']),
              el('dd', {}, [`${card.lock_hours}h`]),
              el('dt', {}, ['Permanent flag']),
              el('dd', {}, [card.permanent_flag]),
            ]),
            el(
              'button',
              {
                test_id: `admin-diamond-3-5-accept-${card.case_id}`,
                classes: [
                  'cnz-button',
                  card.policy_gated ? 'cnz-button--disabled' : 'cnz-button--danger',
                ],
                on: { click: 'acceptThreeFifthsExit' },
                props: {
                  case_id: card.case_id,
                  disabled: card.policy_gated,
                },
              },
              [card.policy_gated ? 'Policy-gated (CEO override)' : 'Confirm 3/5ths Exit'],
            ),
          ],
        ),
      ),
    ],
  );
}

function renderGateGuardFeed(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-gateguard-feed',
      classes: ['cnz-panel', 'cnz-panel--gateguard'],
      aria: { 'aria-label': 'GateGuard live telemetry feed' },
    },
    [
      el('h2', {}, [`GateGuard telemetry (${view.gateguard_feed.length} events shown)`]),
      el(
        'ol',
        { classes: ['cnz-feed'] },
        view.gateguard_feed.map((row) =>
          el(
            'li',
            {
              test_id: `admin-diamond-gg-${row.event_id}`,
              classes: [`cnz-feed__item--${row.decision.toLowerCase()}`],
              props: {
                fraud_score: row.fraud_score,
                welfare_score: row.welfare_score,
              },
            },
            [
              el('span', {}, [row.captured_at_utc]),
              el('span', {}, [row.action]),
              el('span', {}, [row.decision]),
              el('span', {}, [`F:${row.fraud_score} W:${row.welfare_score}`]),
              el('span', {}, [row.reason_codes.join(', ') || '—']),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderWelfarePanel(view: DiamondCommandCenterView): RenderElement {
  const w = view.welfare_panel;
  return el(
    'section',
    {
      test_id: 'admin-diamond-welfare-panel',
      classes: ['cnz-panel', 'cnz-panel--welfare'],
      aria: { 'aria-label': 'Welfare Guardian live panel' },
    },
    [
      el('h2', {}, ['Welfare Guardian']),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Cohort welfare']),
        el('dd', {}, [w.cohort_average_welfare_score.toFixed(1)]),
        el('dt', {}, ['Cohort fraud']),
        el('dd', {}, [w.cohort_average_fraud_score.toFixed(1)]),
        el('dt', {}, ['Active cooldowns']),
        el('dd', {}, [String(w.active_cooldowns)]),
        el('dt', {}, ['Hard declines']),
        el('dd', {}, [String(w.active_hard_declines)]),
        el('dt', {}, ['Human escalations']),
        el('dd', {}, [String(w.active_human_escalations)]),
      ]),
      el(
        'ul',
        { classes: ['cnz-trending'] },
        w.trending_reason_codes.map((row) =>
          el('li', { test_id: `admin-diamond-welfare-trend-${row.reason_code}` }, [
            el('span', {}, [row.reason_code]),
            el('span', {}, [String(row.count)]),
          ]),
        ),
      ),
    ],
  );
}

function renderAuditChain(view: DiamondCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'admin-diamond-audit-chain',
      classes: ['cnz-panel', 'cnz-panel--audit-chain'],
      aria: { 'aria-label': 'Immutable audit chain viewer' },
    },
    [
      el('h2', {}, [`Audit chain (${view.audit_chain_window.length} latest events)`]),
      el('table', { classes: ['cnz-table', 'cnz-table--mono'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Seq']),
            el('th', {}, ['Type']),
            el('th', {}, ['Correlation']),
            el('th', {}, ['Hash']),
            el('th', {}, ['Time']),
          ]),
        ]),
        el(
          'tbody',
          {},
          view.audit_chain_window.map((row) =>
            el(
              'tr',
              {
                test_id: `admin-diamond-audit-${row.event_id}`,
                props: { hash_current: row.hash_current },
              },
              [
                el('td', {}, [row.sequence_number]),
                el('td', {}, [row.event_type]),
                el('td', {}, [row.correlation_id]),
                el('td', { classes: ['cnz-table__hash'] }, [row.hash_current.slice(0, 12) + '…']),
                el('td', {}, [row.occurred_at_utc]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

/**
 * High-heat VIP_DIAMOND queue — surfaces sessions where the guest has reached
 * INFERNO FFS heat. Sorted by score descending. Empty state is rendered when
 * no INFERNO sessions are active.
 */
function renderHighHeatVipQueue(rows: HighHeatVipRow[]): RenderElement {
  if (rows.length === 0) {
    return el(
      'section',
      {
        test_id: 'admin-diamond-high-heat-vip',
        classes: ['cnz-panel', 'cnz-panel--high-heat-vip', 'cnz-panel--empty'],
        aria: { 'aria-label': 'High-heat VIP Diamond queue' },
      },
      [
        el('h2', {}, ['High-Heat VIP Diamond Queue']),
        el('p', { classes: ['cnz-panel__empty-msg'] }, [
          'No INFERNO sessions detected. All VIP Diamond guests are below heat threshold.',
        ]),
      ],
    );
  }

  return el(
    'section',
    {
      test_id: 'admin-diamond-high-heat-vip',
      classes: ['cnz-panel', 'cnz-panel--high-heat-vip', 'cnz-panel--inferno'],
      aria: { 'aria-label': 'High-heat VIP Diamond queue' },
      props: { nats_topic: 'cnz.ffs.vip.inferno' },
    },
    [
      el('h2', {}, [`🔥 High-Heat VIP Diamond Queue (${rows.length})`]),
      el('table', { classes: ['cnz-table', 'cnz-table--heat'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Session']),
            el('th', {}, ['User']),
            el('th', {}, ['FFS Score']),
            el('th', {}, ['Tokens']),
            el('th', {}, ['USD Exposure']),
            el('th', {}, ['Velocity']),
            el('th', {}, ['Detected']),
            el('th', {}, ['Action']),
          ]),
        ]),
        el(
          'tbody',
          {},
          rows.map((row) =>
            el(
              'tr',
              {
                test_id: `admin-diamond-high-heat-${row.session_id}`,
                classes: ['cnz-table__row--inferno'],
                props: {
                  reason_code: row.reason_code,
                  ffs_score: row.ffs_score,
                },
              },
              [
                el('td', {}, [row.session_id.slice(0, 8) + '…']),
                el('td', {}, [row.user_id]),
                el('td', {}, [`${row.ffs_score}/100`]),
                el('td', {}, [row.remaining_tokens]),
                el('td', {}, [row.remaining_usd_cents]),
                el('td', {}, [row.velocity_band]),
                el('td', {}, [row.detected_at_utc]),
                el('td', {}, [
                  el(
                    'button',
                    {
                      test_id: `admin-diamond-high-heat-handoff-${row.session_id}`,
                      classes: ['cnz-button', 'cnz-button--primary', 'cnz-button--sm'],
                      on: { click: 'initiateHandoff' },
                      props: {
                        session_id: row.session_id,
                        user_id: row.user_id,
                        wallet_id: row.wallet_id,
                      },
                    },
                    ['Handoff'],
                  ),
                ]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

/**
 * Operator Quote Generator — allows a Diamond Concierge operator to generate
 * an authoritative Diamond purchase quote by entering token volume and velocity.
 * Step-up auth is always required before any quote is actioned.
 *
 * When operator_quote is null the form is shown in empty/input state.
 * When operator_quote is provided the calculated quote result is displayed.
 */
function renderOperatorQuoteGenerator(
  input: OperatorQuoteInput | null,
  quote: OperatorQuoteDisplay | null,
): RenderElement {
  const quoteResult = quote
    ? el(
        'div',
        {
          test_id: 'admin-diamond-operator-quote-result',
          classes: ['cnz-quote-card'],
          props: {
            correlation_id: quote.correlation_id,
            rule_applied_id: quote.rule_applied_id,
            step_up_auth_required: quote.step_up_auth_required,
          },
        },
        [
          el('h3', {}, ['Quote Result']),
          el('dl', { classes: ['cnz-stat-grid'] }, [
            el('dt', {}, ['Tokens']),
            el('dd', {}, [String(quote.tokens)]),
            el('dt', {}, ['Velocity (days)']),
            el('dd', {}, [String(quote.velocity_days)]),
            el('dt', {}, ['Velocity band']),
            el('dd', {}, [quote.velocity_band]),
            el('dt', {}, ['Base rate']),
            el('dd', {}, [`$${quote.base_rate_usd.toFixed(4)}/CZT`]),
            el('dt', {}, ['Velocity multiplier']),
            el('dd', {}, [String(quote.velocity_multiplier)]),
            el('dt', {}, ['Platform rate']),
            el('dd', {}, [`$${quote.platform_rate_usd.toFixed(4)}/CZT`]),
            el('dt', {}, ['Floor applied']),
            el('dd', {}, [
              formatFloorAppliedDisplay(
                quote.platform_floor_applied,
                quote.platform_floor_per_token_usd,
              ),
            ]),
            el('dt', {}, ['USD total (cents)']),
            el('dd', {}, [quote.usd_total_cents]),
            el('dt', {}, ['Expires']),
            el('dd', {}, [quote.expires_at_utc]),
            el('dt', {}, ['Correlation ID']),
            el('dd', { classes: ['cnz-table__hash'] }, [quote.correlation_id]),
          ]),
          el('div', { classes: ['cnz-cta-row'] }, [
            el(
              'button',
              {
                test_id: 'admin-diamond-operator-quote-confirm',
                classes: ['cnz-button', 'cnz-button--primary'],
                on: { click: 'confirmOperatorQuote' },
                props: {
                  correlation_id: quote.correlation_id,
                  step_up_auth_required: true,
                },
                aria: { 'aria-label': 'Confirm quote — requires step-up authentication' },
              },
              ['Confirm Quote (step-up auth required)'],
            ),
            el(
              'button',
              {
                test_id: 'admin-diamond-operator-quote-discard',
                classes: ['cnz-button', 'cnz-button--ghost'],
                on: { click: 'discardOperatorQuote' },
              },
              ['Discard'],
            ),
          ]),
        ],
      )
    : el('p', { classes: ['cnz-panel__empty-msg'] }, [
        'Enter token volume and velocity days above to generate a quote.',
      ]);

  return el(
    'section',
    {
      test_id: 'admin-diamond-operator-quote',
      classes: ['cnz-panel', 'cnz-panel--operator-quote'],
      aria: { 'aria-label': 'Operator Diamond quote generator' },
    },
    [
      el('h2', {}, ['Operator Quote Generator']),
      el('p', { classes: ['cnz-panel__subtext'] }, [
        `Rate: $0.077 floor / volume + velocity tiers. Step-up auth required to confirm.`,
      ]),
      el(
        'form',
        {
          test_id: 'admin-diamond-operator-quote-form',
          classes: ['cnz-form'],
          on: { submit: 'submitOperatorQuoteForm' },
          props: {
            correlation_id: input?.correlation_id ?? '',
          },
        },
        [
          el('div', { classes: ['cnz-form__field'] }, [
            el('label', { props: { htmlFor: 'operator-quote-tokens' } }, ['Token volume']),
            el('input', {
              test_id: 'admin-diamond-operator-quote-tokens',
              props: {
                id: 'operator-quote-tokens',
                type: 'number',
                name: 'tokens',
                min: 10000,
                step: 1000,
                placeholder: '10000',
                value: input?.tokens ?? '',
                required: true,
              },
            }),
          ]),
          el('div', { classes: ['cnz-form__field'] }, [
            el('label', { props: { htmlFor: 'operator-quote-velocity' } }, ['Velocity (days)']),
            el('input', {
              test_id: 'admin-diamond-operator-quote-velocity',
              props: {
                id: 'operator-quote-velocity',
                type: 'number',
                name: 'velocity_days',
                min: 14,
                step: 1,
                placeholder: '30',
                value: input?.velocity_days ?? '',
                required: true,
              },
            }),
          ]),
          el('div', { classes: ['cnz-form__field'] }, [
            el('label', { props: { htmlFor: 'operator-quote-correlation' } }, ['Correlation ID']),
            el('input', {
              test_id: 'admin-diamond-operator-quote-correlation',
              props: {
                id: 'operator-quote-correlation',
                type: 'text',
                name: 'correlation_id',
                placeholder: 'e.g. HANDOFF-SESSION-abc123',
                value: input?.correlation_id ?? '',
                required: true,
              },
            }),
          ]),
          el(
            'button',
            {
              test_id: 'admin-diamond-operator-quote-submit',
              classes: ['cnz-button', 'cnz-button--primary'],
              props: { type: 'submit' },
            },
            ['Generate Quote'],
          ),
        ],
      ),
      quoteResult,
    ],
  );
}

/** Formats the "floor applied" display string for the operator quote result card. */
function formatFloorAppliedDisplay(applied: boolean, floorRate: number): string {
  return applied ? `Yes ($${floorRate.toFixed(4)}/CZT)` : 'No';
}
