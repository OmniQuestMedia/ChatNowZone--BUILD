// Screen 05 (PIXEL-LEGACY-002) — /creator/pixel-legacy status page.
// Role: Creator (read-only).
// Purpose: Display the creator's Pixel Legacy status. There is NO application
//   form — Pixel Legacy is granted automatically when a creator completes
//   onboarding while the gateway is open (first 3,500 onboardings).
//
// Presenter binding: PixelLegacyStatusView (from creator-panel-contracts.ts).
//
// Layout — three branches:
//   (A) is_pixel_legacy === true
//       "You are Pixel Legacy creator #N" + benefits summary + Cyrano CTA.
//   (B) is_pixel_legacy === false && seat_meter.gateway_open === true
//       "Welcome — Pixel Legacy onboarding is still open." + benefits preview
//       + seat-availability meter.
//   (C) is_pixel_legacy === false && seat_meter.gateway_open === false
//       "Pixel Legacy seats are filled. You are a Standard creator."

import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  PixelLegacyBenefits,
  PixelLegacySeatMeter,
  PixelLegacyStatusView,
} from '../../../types/creator-panel-contracts';

export const PIXEL_LEGACY_PAGE_RULE_ID = 'PIXEL_LEGACY_PAGE_v2';

export interface PixelLegacyPageInputs {
  view: PixelLegacyStatusView;
}

export interface PixelLegacyPageRender {
  metadata: typeof SEO.creator_pixel_legacy;
  view: PixelLegacyStatusView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderPixelLegacyPage(inputs: PixelLegacyPageInputs): PixelLegacyPageRender {
  const { view } = inputs;
  const branch: 'GRANTED' | 'GATEWAY_OPEN' | 'GATEWAY_CLOSED' = view.is_pixel_legacy
    ? 'GRANTED'
    : view.seat_meter.gateway_open
      ? 'GATEWAY_OPEN'
      : 'GATEWAY_CLOSED';

  const tree = el(
    'main',
    {
      test_id: 'pixel-legacy-page',
      classes: ['cnz-creator-pixel-legacy', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, branch },
      aria: { 'aria-label': 'Pixel Legacy creator status' },
    },
    [
      renderHeader(view, branch),
      renderSeatMeter(view.seat_meter),
      branch === 'GRANTED' ? renderGrantedPanel(view) : renderUnfilledPanel(view, branch),
      renderBenefitsPanel(view.benefits, branch),
    ],
  );

  return {
    metadata: SEO.creator_pixel_legacy,
    view,
    tree,
    rule_applied_id: PIXEL_LEGACY_PAGE_RULE_ID,
  };
}

// ─── Header ────────────────────────────────────────────────────────────────

function renderHeader(
  view: PixelLegacyStatusView,
  branch: 'GRANTED' | 'GATEWAY_OPEN' | 'GATEWAY_CLOSED',
): RenderElement {
  const headline =
    branch === 'GRANTED'
      ? 'Pixel Legacy'
      : branch === 'GATEWAY_OPEN'
        ? 'Pixel Legacy'
        : 'Pixel Legacy';

  const subtitle =
    branch === 'GRANTED'
      ? `You are Pixel Legacy creator #${view.seat_number ?? '—'}.`
      : branch === 'GATEWAY_OPEN'
        ? 'Onboarding is still open. Complete your onboarding to claim a seat.'
        : 'Pixel Legacy seats are filled — you are a Standard creator.';

  return el(
    'header',
    {
      test_id: 'pixel-legacy-header',
      classes: ['cnz-pixel-legacy__header', `cnz-pixel-legacy__header--${branch.toLowerCase()}`],
    },
    [
      el('h1', {}, [headline]),
      el(
        'p',
        {
          test_id: 'pixel-legacy-subtitle',
          classes: ['cnz-pixel-legacy__subtitle'],
        },
        [subtitle],
      ),
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

// ─── Seat meter ────────────────────────────────────────────────────────────

function renderSeatMeter(meter: PixelLegacySeatMeter): RenderElement {
  const pct = meter.seats_total > 0 ? Math.round((meter.seats_taken * 100) / meter.seats_total) : 0;
  return el(
    'section',
    {
      test_id: 'pixel-legacy-seat-meter',
      classes: ['cnz-panel', 'cnz-panel--seat-meter'],
      aria: {
        'aria-label': `Pixel Legacy seat availability: ${meter.seats_remaining} of ${meter.seats_total} remaining`,
      },
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
            gateway_open: meter.gateway_open,
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
            ['Pixel Legacy seats are filled. Standard creator onboarding is still open.'],
          )
        : null,
    ].filter(Boolean) as RenderElement[],
  );
}

// ─── Granted panel ─────────────────────────────────────────────────────────

function renderGrantedPanel(view: PixelLegacyStatusView): RenderElement {
  return el(
    'section',
    {
      test_id: 'pixel-legacy-granted-panel',
      classes: ['cnz-panel', 'cnz-panel--granted'],
      aria: { 'aria-label': 'Pixel Legacy granted — creator access unlocked' },
    },
    [
      el('h2', {}, ['Welcome, Pixel Legacy creator']),
      el('p', { test_id: 'pixel-legacy-granted-blurb' }, [
        `Congratulations, ${view.display_name}. You are Pixel Legacy creator ` +
          `#${view.seat_number ?? '—'}. Your profile badge is active and your ` +
          'Cyrano™ lifetime membership has been unlocked.',
      ]),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Seat number']),
        el('dd', { test_id: 'pixel-legacy-seat-number' }, [String(view.seat_number ?? '—')]),
        el('dt', {}, ['Granted on']),
        el('dd', { test_id: 'pixel-legacy-granted-at' }, [
          view.granted_at_utc?.slice(0, 10) ?? '—',
        ]),
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

// ─── Unfilled panel (gateway open or closed) ───────────────────────────────

function renderUnfilledPanel(
  view: PixelLegacyStatusView,
  branch: 'GATEWAY_OPEN' | 'GATEWAY_CLOSED',
): RenderElement {
  const message =
    branch === 'GATEWAY_OPEN'
      ? 'Complete your onboarding to claim a seat. Pixel Legacy seats are first-come-first-served — no application required.'
      : 'Pixel Legacy seats are filled. You are a Standard creator and your earnings + Cyrano access flow through the standard tier.';
  return el(
    'section',
    {
      test_id: 'pixel-legacy-unfilled-panel',
      classes: ['cnz-panel', `cnz-panel--${branch.toLowerCase()}`],
      aria: { 'aria-label': 'Pixel Legacy status' },
    },
    [
      el('h2', {}, ['Your status']),
      el(
        'p',
        {
          test_id: 'pixel-legacy-unfilled-blurb',
          classes: branch === 'GATEWAY_CLOSED' ? ['cnz-status--warn'] : [],
        },
        [message],
      ),
    ],
  );
}

// ─── Benefits panel ────────────────────────────────────────────────────────

function renderBenefitsPanel(
  benefits: PixelLegacyBenefits,
  branch: 'GRANTED' | 'GATEWAY_OPEN' | 'GATEWAY_CLOSED',
): RenderElement {
  const heading = branch === 'GRANTED' ? 'Your benefits' : 'What Pixel Legacy includes';
  return el(
    'section',
    {
      test_id: 'pixel-legacy-benefits',
      classes: ['cnz-panel', 'cnz-panel--benefits'],
      aria: { 'aria-label': 'Pixel Legacy creator benefits' },
    },
    [
      el('h2', {}, [heading]),
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
        el('dd', { test_id: 'pixel-legacy-payout-range' }, [
          `$${benefits.payout_range_min_usd.toFixed(2)}–$${benefits.payout_range_max_usd.toFixed(2)}/CZT`,
        ]),
        el('dt', {}, ['Cyrano™ access']),
        el('dd', { test_id: 'pixel-legacy-cyrano-benefit' }, [
          benefits.lifetime_cyrano ? 'Lifetime membership (no expiration)' : 'Standard access',
        ]),
        el('dt', {}, ['Signing bonus']),
        el('dd', { test_id: 'pixel-legacy-signing-bonus' }, [
          `Month ${benefits.signing_bonus_month} bonus (PIXEL_LEGACY_SIGNING_BONUS)`,
        ]),
      ]),
    ],
  );
}
