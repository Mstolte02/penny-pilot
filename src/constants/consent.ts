/**
 * Consent, in one place. Penny Pilot must both *obtain* and *track* consumer
 * consent before it handles financial data (Plaid remediation item: "implemented
 * a process to obtain and track consent"). This module is the single source of
 * truth for what a user is agreeing to and which version they agreed to, so the
 * client, the local record, and the server-side `user_consents` table all move
 * together.
 *
 * When the substance of what a user agrees to changes, bump CONSENT_VERSION.
 * Every user is then re-prompted on next launch, and the new version is recorded
 * alongside the timestamp — that versioned trail is what makes consent auditable.
 */

/** AsyncStorage key holding the locally-recorded consent record (see ConsentRecord). */
export const CONSENT_STORAGE_KEY = 'penny:consent';

/**
 * Bump this whenever the meaning of consent changes (new data use, new provider,
 * materially revised privacy policy). Prior-version records stay in the trail;
 * the user is re-prompted for the new version.
 */
export const CONSENT_VERSION = '2026-07-19';

export const PRIVACY_POLICY_URL = 'https://penny-pilot.net/privacy';

/**
 * The distinct things a user consents to. Kept as a union so each can be recorded
 * and revoked independently — general app/privacy consent is required to use the
 * app at all; Plaid data-sharing is only relevant if the user chooses to link a bank.
 */
export type ConsentType = 'privacy_terms' | 'plaid_data_sharing';

/** How consent was captured, for the audit trail. */
export type ConsentMethod = 'in_app_gate' | 'plaid_link_prompt';

export type ConsentRecord = {
  version: string;
  acceptedAt: string; // ISO-8601
  types: ConsentType[];
  method: ConsentMethod;
};

/** Human-readable copy for the first-run consent gate, in Penny's voice. */
export const consentCopy = {
  title: 'Before we fly',
  intro:
    'Penny Pilot handles money data, so here is what happens to yours before you start. Nothing is buried in fine print.',
  points: [
    'Without an account, everything stays on this device and Penny never sees it.',
    'If you sign in or connect a bank, your data syncs to our servers so it works across devices.',
    'We never sell your data, show ads, or use tracking SDKs. You can delete everything anytime.',
  ],
  agreeLabel: 'I agree to the Privacy Policy',
  cta: 'Agree and continue',
  linkLabel: 'Read the full Privacy Policy',
} as const;

/** Copy for the Plaid-specific acknowledgment shown before Plaid Link opens. */
export const plaidConsentCopy = {
  title: 'Connecting your bank',
  body: 'You enter your bank login directly with Plaid and your bank. We never see or store it. Plaid shares your account and transaction data with Penny Pilot so it can categorize and budget for you.',
  agreeLabel: 'I understand and want to connect',
} as const;
