// Screen 05 — /creator/pixel-legacy Pixel Legacy Onboarding page.
// Role: Creator (applicant).
// Purpose: Apply for and track Pixel Legacy status.
//
// Presenter binding: PixelLegacyApplicationView (from creator-panel-contracts.ts).
// States handled: DRAFT | APPLIED | REVIEWED | GRANTED | DENIED
//
// Layout (top → bottom):
//   1. Status tracker (Applied → Reviewed → Granted / Denied)
//   2. Seat availability meter (3,500 cap)
//   3. Benefits preview ($0.07–$0.09/token + lifetime Cyrano™)
//   4. Application form (portfolio entries + proof statement)
//   5. Post-grant: Cyrano panel unlock CTA
//
// Interactions:
//   • Form submission → GateGuard pre-process + audit write
//   • On GRANTED → auto-unlock creator Cyrano panel

import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  PixelLegacyApplicationStatus,
  PixelLegacyApplicationView,
  PixelLegacyBenefits,
  PixelLegacyPortfolioEntry,
  PixelLegacySeatMeter,
} from '../../../types/creator-panel-contracts';


export const PIXEL_LEGACY_PAGE_RULE_ID = 'PIXEL_LEGACY_PAGE_v1';

export interface PixelLegacyPageInputs {
  /** Pre-built view model from the presenter / API response. */
  view: PixelLegacyApplicationView;
}

export interface PixelLegacyPageRender {
  metadata: typeof SEO.creator_pixel_legacy;
  view: PixelLegacyApplicationView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderPixelLegacyPage(inputs: PixelLegacyPageInputs): PixelLegacyPageRender {
  const { view } = inputs;

  const tree = el(
    'main',
    {
      test_id: 'pixel-legacy-page',
      classes: ['cnz-creator-pixel-legacy', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, status: view.status },
      aria: { 'aria-label': 'Pixel Legacy creator onboarding' },
    },
    [
      renderHeader(view),
      renderStatusTracker(view.status),
      renderSeatMeter(view.seat_meter),
      renderBenefitsPreview(view.benefits),
      view.status === 'GRANTED'
        ? renderGrantedPanel(view)
        : renderApplicationForm(view),
    ],
  );

  return {
    metadata: SEO.creator_pixel_legacy,
    view,
    tree,
    rule_applied_id: PIXEL_LEGACY_PAGE_RULE_ID,
  };
}

// ─── Page header ───────────────────────────────────────────────────────────

function renderHeader(view: PixelLegacyApplicationView): RenderElement {
  return el(
    'header',
    {
      test_id: 'pixel-legacy-header',
      classes: ['cnz-pixel-legacy__header'],
    },
    [
      el('h1', {}, ['Pixel Legacy']),
      el('p', { classes: ['cnz-pixel-legacy__subtitle'] }, [
        'Secure one of the first 3,500 creator seats — earn at the full payout range ' +
          'with a lifetime Cyrano™ membership.',
      ]),
      el(
        'span',
        {
          test_id: 'pixel-legacy-creator-id',
          classes: ['cnz-affiliation-chip'],
          props: { creator_id: view.creator_id },
        },
        [view.display_name],
      ),
    ],
  );
}

// ─── Status tracker ────────────────────────────────────────────────────────

const STATUS_STEPS: PixelLegacyApplicationStatus[] = [
  'APPLIED',
  'REVIEWED',
  'GRANTED',
];

function renderStatusTracker(status: PixelLegacyApplicationStatus): RenderElement {
  const isDenied = status === 'DENIED';
  return el(
    'section',
    {
      test_id: 'pixel-legacy-status-tracker',
      classes: ['cnz-panel', 'cnz-panel--status-tracker'],
      aria: { 'aria-label': 'Application status tracker' },
    },
    [
      el('h2', {}, ['Application status']),
      isDenied
        ? el(
            'div',
            {
              test_id: 'pixel-legacy-status-denied',
              classes: ['cnz-status--danger'],
            },
            ['Application not approved — contact support if you have questions.'],
          )
        : el(
            'ol',
            {
              classes: ['cnz-status-steps'],
              aria: { role: 'list', 'aria-label': 'Application progress steps' },
            },
            STATUS_STEPS.map((step) => {
              const isPast = isStepCompleted(step, status);
              const isCurrent = step === status;
              return el(
                'li',
                {
                  test_id: `pixel-legacy-step-${step.toLowerCase()}`,
                  classes: [
                    'cnz-status-steps__item',
                    isPast ? 'cnz-status-steps__item--complete' : '',
                    isCurrent ? 'cnz-status-steps__item--current' : '',
                  ].filter(Boolean),
                  aria: { role: 'listitem' },
                },
                [stepLabel(step)],
              );
            }),
          ),
    ],
  );
}

function isStepCompleted(step: PixelLegacyApplicationStatus, current: PixelLegacyApplicationStatus): boolean {
  const order: PixelLegacyApplicationStatus[] = ['DRAFT', 'APPLIED', 'REVIEWED', 'GRANTED'];
  return order.indexOf(step) < order.indexOf(current);
}

function stepLabel(step: PixelLegacyApplicationStatus): string {
  switch (step) {
    case 'APPLIED':   return 'Applied';
    case 'REVIEWED':  return 'Reviewed';
    case 'GRANTED':   return 'Granted';
    default:          return step;
  }
}

// ─── Seat availability meter ───────────────────────────────────────────────

function renderSeatMeter(meter: PixelLegacySeatMeter): RenderElement {
  const pct = meter.seats_total > 0
    ? Math.round((meter.seats_taken * 100) / meter.seats_total)
    : 0;
  return el(
    'section',
    {
      test_id: 'pixel-legacy-seat-meter',
      classes: ['cnz-panel', 'cnz-panel--seat-meter'],
      aria: { 'aria-label': `Pixel Legacy seat availability: ${meter.seats_remaining} of ${meter.seats_total} remaining` },
    },
    [
      el('h2', {}, ['Seat availability']),
      el(
        'div',
        {
          test_id: 'pixel-legacy-seat-bar',
          classes: ['cnz-seat-meter'],
          props: {
            seats_taken: meter.seats_taken,
            seats_total: meter.seats_total,
            seats_remaining: meter.seats_remaining,
            pct_filled: pct,
            cap_reached: meter.cap_reached,
          },
          aria: {
            role: 'progressbar',
            'aria-valuenow': String(meter.seats_taken),
            'aria-valuemin': '0',
            'aria-valuemax': String(meter.seats_total),
            'aria-label': `${pct}% of seats filled`,
          },
        },
        [],
      ),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Seats taken']),
        el('dd', { test_id: 'pixel-legacy-seats-taken' }, [String(meter.seats_taken)]),
        el('dt', {}, ['Seats remaining']),
        el('dd', { test_id: 'pixel-legacy-seats-remaining' }, [String(meter.seats_remaining)]),
        el('dt', {}, ['Cap']),
        el('dd', {}, [String(meter.seats_total)]),
      ]),
      meter.cap_reached
        ? el(
            'p',
            {
              test_id: 'pixel-legacy-cap-reached-notice',
              classes: ['cnz-status--warn'],
            },
            ['All Pixel Legacy seats have been claimed. Standard creator onboarding is still open.'],
          )
        : null,
    ].filter(Boolean) as RenderElement[],
  );
}

// ─── Benefits preview ──────────────────────────────────────────────────────

function renderBenefitsPreview(benefits: PixelLegacyBenefits): RenderElement {
  return el(
    'section',
    {
      test_id: 'pixel-legacy-benefits',
      classes: ['cnz-panel', 'cnz-panel--benefits'],
      aria: { 'aria-label': 'Pixel Legacy creator benefits' },
    },
    [
      el('h2', {}, ['Benefits']),
      el(
        'span',
        {
          test_id: 'pixel-legacy-badge-label',
          classes: ['cnz-tier-badge', 'cnz-tier-badge--pixel-legacy'],
        },
        [benefits.badge_label],
      ),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Payout range']),
        el(
          'dd',
          { test_id: 'pixel-legacy-payout-range' },
          [
            `$${benefits.payout_range_min_usd.toFixed(2)}–$${benefits.payout_range_max_usd.toFixed(2)}/CZT`,
          ],
        ),
        el('dt', {}, ['Cyrano™ access']),
        el(
          'dd',
          { test_id: 'pixel-legacy-cyrano-benefit' },
          [benefits.lifetime_cyrano ? 'Lifetime membership (no expiration)' : 'Standard access'],
        ),
        el('dt', {}, ['Signing bonus']),
        el(
          'dd',
          { test_id: 'pixel-legacy-signing-bonus' },
          [`Month ${benefits.signing_bonus_month} bonus (PIXEL_LEGACY_SIGNING_BONUS)`],
        ),
      ]),
    ],
  );
}

// ─── Application form ──────────────────────────────────────────────────────

function renderApplicationForm(view: PixelLegacyApplicationView): RenderElement {
  const isSubmitted = view.status !== 'DRAFT';
  return el(
    'section',
    {
      test_id: 'pixel-legacy-application-form',
      classes: ['cnz-panel', 'cnz-panel--application'],
      aria: { 'aria-label': 'Pixel Legacy application form' },
    },
    [
      el('h2', {}, ['Your application']),
      isSubmitted
        ? el(
            'p',
            {
              test_id: 'pixel-legacy-submitted-notice',
              classes: ['cnz-status--ok'],
            },
            [
              `Application submitted ${view.submitted_at_utc?.slice(0, 10) ?? '—'}. ` +
                'You will be notified by email when it is reviewed.',
            ],
          )
        : null,
      renderPortfolioEntries(view.portfolio_entries, isSubmitted),
      renderProofStatement(view.proof_statement, isSubmitted),
      isSubmitted
        ? null
        : el(
            'button',
            {
              test_id: 'pixel-legacy-submit',
              classes: ['cnz-button', 'cnz-button--primary'],
              on: { click: 'submitPixelLegacyApplication' },
              props: { creator_id: view.creator_id },
            },
            ['Submit application'],
          ),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderPortfolioEntries(entries: PixelLegacyPortfolioEntry[], readOnly: boolean): RenderElement {
  return el(
    'div',
    {
      test_id: 'pixel-legacy-portfolio',
      classes: ['cnz-pixel-legacy__portfolio'],
    },
    [
      el('h3', {}, ['Portfolio / proof of work']),
      entries.length === 0
        ? el(
            'p',
            { classes: ['cnz-panel--empty'] },
            ['Add at least one portfolio link before submitting.'],
          )
        : el(
            'ul',
            { classes: ['cnz-list'] },
            entries.map((entry) =>
              el(
                'li',
                {
                  test_id: `pixel-legacy-portfolio-${entry.entry_id}`,
                  classes: ['cnz-list__item'],
                  props: { entry_id: entry.entry_id },
                },
                [
                  el('strong', {}, [entry.label]),
                  el(
                    'a',
                    {
                      classes: ['cnz-link'],
                      props: { href: entry.url, rel: 'noopener noreferrer', target: '_blank' },
                    },
                    [entry.url],
                  ),
                  readOnly
                    ? null
                    : el(
                        'button',
                        {
                          test_id: `pixel-legacy-remove-entry-${entry.entry_id}`,
                          classes: ['cnz-button', 'cnz-button--ghost', 'cnz-button--sm'],
                          on: { click: 'removePortfolioEntry' },
                          props: { entry_id: entry.entry_id },
                        },
                        ['Remove'],
                      ),
                ].filter(Boolean) as RenderElement[],
              ),
            ),
          ),
      readOnly
        ? null
        : el(
            'button',
            {
              test_id: 'pixel-legacy-add-portfolio-entry',
              classes: ['cnz-button', 'cnz-button--ghost'],
              on: { click: 'addPortfolioEntry' },
            },
            ['+ Add portfolio link'],
          ),
    ].filter(Boolean) as RenderElement[],
  );
}

function renderProofStatement(statement: string, readOnly: boolean): RenderElement {
  return el(
    'div',
    {
      test_id: 'pixel-legacy-proof-statement',
      classes: ['cnz-pixel-legacy__proof'],
    },
    [
      el('h3', {}, ['Proof statement']),
      el('p', { classes: ['cnz-pixel-legacy__proof-hint'] }, [
        'Describe your creator background, audience, and why you are applying for Pixel Legacy status.',
      ]),
      readOnly
        ? el(
            'blockquote',
            {
              test_id: 'pixel-legacy-proof-text',
              classes: ['cnz-pixel-legacy__proof-text'],
            },
            [statement || '—'],
          )
        : el(
            'textarea',
            {
              test_id: 'pixel-legacy-proof-textarea',
              classes: ['cnz-textarea'],
              props: { value: statement, maxlength: 2000, required: true },
              on: { input: 'updateProofStatement' },
              aria: { 'aria-label': 'Proof statement text area' },
            },
            [],
          ),
    ],
  );
}

// ─── Post-grant panel ──────────────────────────────────────────────────────

function renderGrantedPanel(view: PixelLegacyApplicationView): RenderElement {
  return el(
    'section',
    {
      test_id: 'pixel-legacy-granted-panel',
      classes: ['cnz-panel', 'cnz-panel--granted'],
      aria: { 'aria-label': 'Pixel Legacy granted — creator access unlocked' },
    },
    [
      el('h2', {}, ['🎉 Pixel Legacy granted']),
      el('p', {}, [
        `Congratulations, ${view.display_name}! You are now a Pixel Legacy creator. ` +
          'Your profile badge is active and your Cyrano™ lifetime membership has been unlocked.',
      ]),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Application ID']),
        el('dd', { test_id: 'pixel-legacy-application-id' }, [view.application_id ?? '—']),
        el('dt', {}, ['Decision date']),
        el('dd', {}, [view.reviewed_at_utc?.slice(0, 10) ?? '—']),
      ]),
      view.cyrano_panel_unlocked
        ? el(
            'button',
            {
              test_id: 'pixel-legacy-open-cyrano',
              classes: ['cnz-button', 'cnz-button--primary'],
              on: { click: 'navigateToCyranoPanel' },
              props: { creator_id: view.creator_id },
            },
            ['Open Cyrano™ Panel'],
          )
        : null,
    ].filter(Boolean) as RenderElement[],
  );
}
