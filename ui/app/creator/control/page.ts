// PAYLOAD 7 — /creator/control CreatorControl.Zone command center page.
// Core Surface 02 — Creator Cyrano Control Panel.
// Adds CyranoSessionSummary widget and Diamond Concierge handoff CTA (+modal)
// on top of the existing heat meter, session monitoring, broadcast timing,
// Cyrano panel, and persona switcher.

import {
  CreatorControlPresenter,
  type CreatorCommandCenterInputs,
} from '../../../view-models/creator-control.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { heatColorFor } from '../../../config/theme';
import { heatTierAriaLabel } from '../../../config/accessibility';
import { el, RenderElement } from '../../../components/render-plan';
import { renderSendGiftPanel } from '../../../components/send-gift-panel';
import type { CreatorCommandCenterView, CyranoSessionSummary, DiamondHandoffCta } from '../../../types/creator-panel-contracts';

export const CREATOR_CONTROL_PAGE_RULE_ID = 'CREATOR_CONTROL_PAGE_v1';

export interface CreatorControlPageRender {
  metadata: typeof SEO.creator_control;
  view: CreatorCommandCenterView;
  cyrano_summary: CyranoSessionSummary;
  handoff_cta: DiamondHandoffCta | null;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderCreatorControlPage(
  inputs: CreatorCommandCenterInputs & {
    /** When true the handoff quote modal is initially open. Default false. */
    handoff_modal_open?: boolean;
    /** Estimated token volume for the handoff quote (optional, from session velocity). */
    handoff_estimated_tokens?: number | null;
  },
): CreatorControlPageRender {
  const presenter = new CreatorControlPresenter();
  const now = inputs.now_utc ?? new Date();
  const view = presenter.buildCommandCenterView(inputs);

  const cyrano_summary = presenter.buildCyranoSessionSummary(inputs, now);

  const handoff_cta = inputs.active_session_id
    ? presenter.buildHandoffCta(
        inputs.active_session_id,
        inputs.latest_heat?.score ?? 0,
        inputs.latest_heat?.tier ?? 'COLD',
        inputs.handoff_estimated_tokens ?? null,
      )
    : null;

  const tree = el(
    'main',
    {
      test_id: 'creator-control-page',
      classes: ['cnz-creator-control', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode },
      aria: { 'aria-label': 'CreatorControl.Zone command center' },
    },
    [
      el('header', { test_id: 'creator-control-header', classes: ['cnz-cc__header'] }, [
        el('h1', {}, [view.display_name]),
        el('div', { classes: ['cnz-cc__status-strip'] }, [
          el(
            'span',
            {
              test_id: 'creator-control-obs-status',
              classes: [view.obs_ready ? 'cnz-status--ok' : 'cnz-status--warn'],
            },
            [`OBS: ${view.obs_ready ? 'connected' : 'offline'}`],
          ),
          el(
            'span',
            {
              test_id: 'creator-control-chat-status',
              classes: [view.chat_aggregator_ready ? 'cnz-status--ok' : 'cnz-status--warn'],
            },
            [`Chat aggregator: ${view.chat_aggregator_ready ? 'live' : 'offline'}`],
          ),
          renderPayoutChip(view),
        ]),
      ]),
      renderCyranoSessionSummary(cyrano_summary),
      handoff_cta
        ? renderHandoffCta(handoff_cta, inputs.handoff_modal_open ?? false)
        : null,
      renderHeatMeter(view),
      renderSessionMonitoring(view),
      renderBroadcastTiming(view),
      renderCyranoPanel(view),
      renderPersonaSwitcher(view),
      renderSendGiftPanel({ creator_id: view.creator_id }).tree,
    ],
  );

  return {
    metadata: SEO.creator_control,
    view,
    cyrano_summary,
    handoff_cta,
    tree,
    rule_applied_id: CREATOR_CONTROL_PAGE_RULE_ID,
  };
}

function renderPayoutChip(view: CreatorCommandCenterView): RenderElement {
  const p = view.payout_rate;
  return el(
    'span',
    {
      test_id: 'creator-control-payout-chip',
      classes: ['cnz-cc__payout-chip'],
      props: {
        scaling_pct: p.scaling_pct_applied,
        rate: p.current_rate_per_token_usd,
      },
    },
    [
      el('strong', {}, [`$${p.current_rate_per_token_usd.toFixed(3)}/CZT`]),
      el('span', {}, [
        p.scaling_pct_applied > 0 ? `+${p.scaling_pct_applied}% (${p.tier_context})` : 'baseline',
      ]),
    ],
  );
}

function renderHeatMeter(view: CreatorCommandCenterView): RenderElement {
  if (!view.heat_meter) {
    return el(
      'section',
      {
        test_id: 'creator-control-heat-meter',
        classes: ['cnz-panel', 'cnz-panel--heat-meter', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Room-Heat meter (no live session)' },
      },
      [el('p', {}, ['No live session — heat meter idle.'])],
    );
  }
  const m = view.heat_meter;
  const color = heatColorFor(m.tier);
  return el(
    'section',
    {
      test_id: 'creator-control-heat-meter',
      classes: ['cnz-panel', 'cnz-panel--heat-meter'],
      aria: { 'aria-label': heatTierAriaLabel(m.tier, m.score) },
      style: { '--cnz-heat-color': color },
    },
    [
      el('h2', {}, ['Room heat']),
      el(
        'div',
        {
          classes: ['cnz-heat-gauge'],
          props: {
            tier: m.tier,
            score: m.score,
            tier_min: m.tier_min,
            tier_max: m.tier_max,
          },
        },
        [
          el('strong', { test_id: 'creator-control-heat-score' }, [String(m.score)]),
          el('span', { test_id: 'creator-control-heat-tier' }, [m.tier]),
        ],
      ),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Tipper pressure']),
        el('dd', {}, [String(m.components.tipper_pressure)]),
        el('dt', {}, ['Velocity']),
        el('dd', {}, [String(m.components.velocity)]),
        el('dt', {}, ['VIP presence']),
        el('dd', {}, [String(m.components.vip_presence)]),
      ]),
    ],
  );
}

function renderSessionMonitoring(view: CreatorCommandCenterView): RenderElement {
  const sm = view.session_monitoring;
  return el(
    'section',
    {
      test_id: 'creator-control-session-monitoring',
      classes: ['cnz-panel', 'cnz-panel--session-monitoring'],
      aria: { 'aria-label': 'Live Session Monitoring' },
    },
    [
      el('h2', {}, ['Live Session Monitoring']),
      sm.latest_nudge
        ? el(
            'article',
            {
              test_id: 'creator-control-nudge-card',
              classes: [
                'cnz-nudge-card',
                `cnz-nudge-card--${sm.latest_nudge.direction.toLowerCase()}`,
              ],
              props: {
                direction: sm.latest_nudge.direction,
                magnitude_pct: sm.latest_nudge.magnitude_pct,
                reason_code: sm.latest_nudge.reason_code,
              },
            },
            [
              el('header', {}, [
                el('span', {}, [sm.latest_nudge.direction]),
                el('span', {}, [`${(sm.latest_nudge.magnitude_pct * 100).toFixed(0)}%`]),
              ]),
              el('p', {}, [sm.latest_nudge.copy]),
              el('footer', {}, [sm.latest_nudge.reason_code]),
            ],
          )
        : el('p', { classes: ['cnz-panel--empty'] }, ['No nudge — latest signal too cold.']),
    ],
  );
}

function renderBroadcastTiming(view: CreatorCommandCenterView): RenderElement {
  const bt = view.broadcast_timing;
  return el(
    'section',
    {
      test_id: 'creator-control-broadcast-timing',
      classes: ['cnz-panel', 'cnz-panel--broadcast-timing'],
      aria: { 'aria-label': 'Broadcast Timing Copilot' },
    },
    [
      el('h2', {}, ['Broadcast Timing Copilot']),
      el('table', { classes: ['cnz-table'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Slot (UTC)']),
            el('th', {}, ['Confidence']),
            el('th', {}, ['Tippers']),
            el('th', {}, ['TPM']),
            el('th', {}, ['Reason']),
          ]),
        ]),
        el(
          'tbody',
          {},
          bt.windows.map((w) =>
            el(
              'tr',
              {
                test_id: `creator-control-window-${w.suggested_slot_utc}`,
                props: { reason_code: w.reason_code },
              },
              [
                el('td', {}, [w.suggested_slot_utc]),
                el('td', {}, [`${(w.confidence * 100).toFixed(0)}%`]),
                el('td', {}, [String(w.expected_tippers)]),
                el('td', {}, [w.expected_tips_per_minute.toFixed(1)]),
                el('td', {}, [w.reason_code]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

function renderCyranoPanel(view: CreatorCommandCenterView): RenderElement {
  const c = view.cyrano_panel;
  return el(
    'section',
    {
      test_id: 'creator-control-cyrano-panel',
      classes: ['cnz-panel', 'cnz-panel--cyrano'],
      aria: { 'aria-label': 'Cyrano whisper panel' },
    },
    [
      el('header', {}, [
        el('h2', {}, ['Cyrano™ whispers']),
        el('span', { classes: ['cnz-cyrano__sla'] }, [
          c.latency_last_observed_ms !== null
            ? `${c.latency_last_observed_ms}ms / SLA ${c.latency_sla_ms}ms`
            : `SLA ${c.latency_sla_ms}ms`,
        ]),
      ]),
      el(
        'ol',
        { classes: ['cnz-cyrano__feed'] },
        c.suggestions.map((s) =>
          el(
            'li',
            {
              test_id: `creator-control-cyrano-${s.suggestion_id}`,
              classes: [
                'cnz-cyrano__suggestion',
                `cnz-cyrano__suggestion--${s.tier_context.toLowerCase()}`,
              ],
              props: {
                category: s.category,
                weight: s.weight,
                tier_context: s.tier_context,
              },
            },
            [
              el('header', {}, [
                el('strong', {}, [s.category]),
                el('span', {}, [`weight ${s.weight}`]),
              ]),
              el('p', {}, [s.copy]),
              el('footer', {}, [s.reason_codes.join(', ')]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderPersonaSwitcher(view: CreatorCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'creator-control-persona-switcher',
      classes: ['cnz-panel', 'cnz-panel--persona-switcher'],
      aria: { 'aria-label': 'Cyrano persona switcher' },
    },
    [
      el('h2', {}, ['Personas']),
      el(
        'ul',
        { classes: ['cnz-persona-list'] },
        view.cyrano_panel.personas_available.map((p) =>
          el(
            'li',
            {
              test_id: `creator-control-persona-${p.persona_id}`,
              classes: [p.active ? 'cnz-persona-list__item--active' : ''],
              props: { active: p.active, persona_id: p.persona_id },
            },
            [
              el('strong', {}, [p.display_name]),
              el('span', {}, [p.tone]),
              el('p', {}, [p.style_notes]),
              el(
                'button',
                {
                  test_id: `creator-control-persona-activate-${p.persona_id}`,
                  classes: [
                    'cnz-button',
                    p.active ? 'cnz-button--disabled' : 'cnz-button--primary',
                  ],
                  on: { click: 'activatePersona' },
                  props: { persona_id: p.persona_id, disabled: p.active },
                },
                [p.active ? 'Active' : 'Activate'],
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

/**
 * CyranoSessionSummary — compact status card at the top of the command pane.
 * Shows persona, suggestion count, and SLA latency at a glance.
 */
function renderCyranoSessionSummary(summary: CyranoSessionSummary): RenderElement {
  const latencyOk = summary.latency_within_sla;
  const latencyDisplay =
    summary.latency_last_observed_ms !== null
      ? `${summary.latency_last_observed_ms}ms`
      : '—';

  return el(
    'section',
    {
      test_id: 'creator-control-cyrano-summary',
      classes: ['cnz-panel', 'cnz-panel--cyrano-summary'],
      aria: { 'aria-label': 'Cyrano session summary' },
      props: { nats_topic: 'cnz.cyrano.summary' },
    },
    [
      el('header', { classes: ['cnz-panel__header'] }, [
        el('h2', {}, ['Cyrano™ Session']),
        el(
          'span',
          {
            test_id: 'creator-control-cyrano-summary-latency',
            classes: [
              'cnz-cyrano-summary__latency',
              latencyOk ? 'cnz-status--ok' : 'cnz-status--warn',
            ],
          },
          [`Latency: ${latencyDisplay} / SLA ${summary.latency_sla_ms}ms`],
        ),
      ]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Persona']),
        el(
          'dd',
          { test_id: 'creator-control-cyrano-summary-persona' },
          [summary.active_persona_display_name ?? 'None active'],
        ),
        el('dt', {}, ['Suggestions']),
        el(
          'dd',
          { test_id: 'creator-control-cyrano-summary-count' },
          [String(summary.suggestion_count)],
        ),
        el('dt', {}, ['Heat tier']),
        el('dd', {}, [summary.tier_context]),
      ]),
    ],
  );
}

/**
 * Diamond Concierge handoff CTA — shown only at INFERNO heat.
 * Includes a modal with the handoff quote URL and floor/ceiling rate context.
 * The modal is rendered collapsed by default; open via handoff_modal_open input.
 */
function renderHandoffCta(cta: DiamondHandoffCta, modalOpen: boolean): RenderElement {
  return el(
    'section',
    {
      test_id: 'creator-control-handoff-cta',
      classes: ['cnz-panel', 'cnz-panel--handoff', 'cnz-panel--inferno'],
      aria: { 'aria-label': 'Diamond Concierge high-heat handoff' },
      props: {
        session_id: cta.session_id,
        ffs_score: cta.ffs_score,
        reason_code: cta.reason_code,
      },
    },
    [
      el('header', { classes: ['cnz-panel__header'] }, [
        el('h2', {}, ['🔥 INFERNO — Diamond Concierge Handoff Available']),
        el('p', { classes: ['cnz-panel__subtext'] }, [
          `Session heat at ${cta.ffs_score}/100. A Diamond Concierge can maximise revenue.`,
        ]),
      ]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Floor rate']),
        el('dd', {}, [`$${cta.floor_rate_usd.toFixed(3)}/CZT`]),
        el('dt', {}, ['Ceiling rate']),
        el('dd', {}, [`$${cta.ceiling_rate_usd.toFixed(3)}/CZT`]),
        ...(cta.estimated_volume_tokens !== null
          ? [
              el('dt', {}, ['Est. volume']),
              el('dd', {}, [`${cta.estimated_volume_tokens.toLocaleString('en-US')} CZT`]),
            ]
          : []),
      ]),
      el(
        'button',
        {
          test_id: 'creator-control-handoff-open-modal',
          classes: ['cnz-button', 'cnz-button--primary', 'cnz-button--revenue'],
          on: { click: 'openHandoffQuoteModal' },
          props: { session_id: cta.session_id },
        },
        ['Request Diamond Concierge Handoff'],
      ),
      el(
        'div',
        {
          test_id: 'creator-control-handoff-modal',
          classes: ['cnz-modal', modalOpen ? 'cnz-modal--open' : 'cnz-modal--hidden'],
          aria: { 'aria-modal': 'true', role: 'dialog' },
          props: { open: modalOpen },
        },
        [
          el('header', { classes: ['cnz-modal__header'] }, [
            el('h3', {}, ['Confirm Handoff to Diamond Concierge']),
            el(
              'button',
              {
                test_id: 'creator-control-handoff-modal-close',
                classes: ['cnz-button', 'cnz-button--ghost'],
                on: { click: 'closeHandoffQuoteModal' },
              },
              ['Cancel'],
            ),
          ]),
          el('p', {}, [
            'Initiating a handoff will connect your session with an OQMI Diamond Concierge ' +
              'who will manage the high-value guest relationship. ' +
              'Your payout rate is preserved at the REDBOOK scale.',
          ]),
          el(
            'a',
            {
              test_id: 'creator-control-handoff-quote-link',
              classes: ['cnz-button', 'cnz-button--primary'],
              props: { href: cta.handoff_quote_url },
              on: { click: 'navigateToHandoffQuote' },
            },
            ['View handoff quote →'],
          ),
        ],
      ),
    ],
  );
}
