import { el, RenderElement } from './render-plan';

const TWIN_CONSENT_TEXT =
  'Twin Mode Consent: I explicitly authorize this platform to generate synthetic twin media tied to my character context and account identity for approved usage flows.';

const FANTASY_CONSENT_TEXT =
  'Fantasy Mode Consent: I understand this mode creates fictionalized content not intended to replicate real persons, and I agree to policy-based guardrails.';

export function renderSyntheticTwinConsentModals(
  openModal?: 'twin' | 'fantasy' | null,
): RenderElement {
  return el(
    'section',
    {
      test_id: 'synthetic-twin-consent-modals',
      classes: ['cnz-panel', 'cnz-panel--consent-modals'],
      aria: { 'aria-label': 'Synthetic Twin consent flows' },
    },
    [
      renderConsentModal('twin', TWIN_CONSENT_TEXT, openModal === 'twin'),
      renderConsentModal('fantasy', FANTASY_CONSENT_TEXT, openModal === 'fantasy'),
    ],
  );
}

function renderConsentModal(
  mode: 'twin' | 'fantasy',
  consentText: string,
  open: boolean,
): RenderElement {
  return el(
    'article',
    {
      test_id: `synthetic-twin-consent-modal-${mode}`,
      classes: [
        'cnz-consent-modal',
        `cnz-consent-modal--${mode}`,
        open ? 'cnz-consent-modal--open' : 'cnz-consent-modal--closed',
      ],
      props: {
        consent_mode: mode,
      },
      aria: {
        role: 'dialog',
        'aria-label': `${mode.toUpperCase()} consent modal`,
      },
    },
    [
      el('h3', {}, [mode === 'twin' ? 'Twin Mode Consent' : 'Fantasy Mode Consent']),
      el('p', { classes: ['cnz-consent-modal__text'] }, [consentText]),
      el('div', { classes: ['cnz-cta-row'] }, [
        el(
          'button',
          {
            test_id: `synthetic-twin-consent-accept-${mode}`,
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: `acceptSyntheticTwinConsent:${mode}` },
          },
          ['Accept'],
        ),
        el(
          'button',
          {
            test_id: `synthetic-twin-consent-decline-${mode}`,
            classes: ['cnz-button', 'cnz-button--ghost'],
            on: { click: `declineSyntheticTwinConsent:${mode}` },
          },
          ['Decline'],
        ),
      ]),
    ],
  );
}
