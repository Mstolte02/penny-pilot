# Plaid Remediation — Attestation Readiness

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Prepared:** 2026-07-19
**All items due:** 2027-01-07

## What this is

Plaid's remediation program requires Penny Pilot to attest to eleven security and privacy
controls by **2027-01-07**. This document maps each required attestation to the concrete
evidence that supports it — policy documents, code, and configuration — and states honestly
whether Penny Pilot can attest today, can attest with a caveat, or still has work to do.

Penny Pilot is a pre-launch, single-founder app; every attestation is founder-attested
rather than independently audited, which is appropriate at this stage and disclosed as such
throughout the [security policy set](README.md). "Attest" here means the founder can
truthfully sign that the control is in place as described.

## Readiness at a glance

| # | Attestation | Status |
|---|---|---|
| 1 | Role-based access control (RBAC) | ✅ Ready |
| 2 | Process to obtain and track consent | ✅ Ready |
| 3 | Zero trust access architecture | ✅ Ready |
| 4 | Robust MFA on the consumer-facing app (Plaid Link) | ✅ Ready (delegated MFA) |
| 5 | Robust MFA on internal systems handling consumer data | ✅ Ready |
| 6 | EOL software monitoring + policy | ✅ Ready |
| 7 | Data deletion and retention policy | ✅ Ready (export flow is a follow-up) |
| 8 | Automated de-provisioning for terminated/transferred employees | ✅ Ready (N/A — solo team, policy in place) |
| 9 | Vulnerability scanning | ✅ Ready |
| 10 | Patch vulnerabilities within a defined SLA | ✅ Ready |
| 11 | Published privacy policy | ✅ Ready |

## Item-by-item evidence

### 1. Role-based access control (RBAC)

**Evidence:** [Access Control Policy](access-control-policy.md).
Two enforced access surfaces:
- *Consumer data:* Postgres Row Level Security on every user-owned table
  (`supabase/migrations/0001_initial_schema.sql`), policy `user_id = auth.uid()`. Privileged
  writes (`entitlements`, `plaid_items`) have no client write policy — backend roles only.
- *Operator/admin:* per-vendor named accounts with least-privilege grants documented for
  when a second person joins.

**Attest?** Yes.

### 2. Process to obtain and track consent

**Evidence:** [Privacy Policy](../privacy-policy.md); code — `src/constants/consent.ts`,
`src/components/consent-gate.tsx`, `src/hooks/use-consent.ts`,
`src/components/bank-link-button.native.tsx`; schema —
`supabase/migrations/0003_consent_tracking.sql` (`user_consents`).
Consent is *obtained* via a first-run gate and a Plaid data-sharing acknowledgment, and
*tracked* as versioned, timestamped, immutable rows in `user_consents` (plus a local record
for the no-account mode). Bumping `CONSENT_VERSION` re-prompts all users and preserves the
prior record. See Plaid questionnaire Q9.

**Attest?** Yes.

### 3. Zero trust access architecture

**Evidence:** [Zero Trust Access Architecture](zero-trust-architecture.md).
No trusted internal network exists; every request is authenticated and authorized on its
own merits (RLS on data, bearer-token verification on every Edge Function invocation),
secrets are least-privilege and function-scoped, and "assume breach" is handled by
encrypting Plaid tokens at the application layer so an authorized DB read still yields no
usable credential.

**Attest?** Yes.

### 4. Robust MFA on the consumer-facing app where Plaid Link is deployed

**Evidence:** [Password & MFA Policy](password-mfa-policy.md) (end-user section);
`src/services/supabase-client.ts` (OAuth PKCE).
Penny Pilot stores no passwords. Sign-in is delegated to Apple and Google via OAuth PKCE,
so any MFA a user has on their Apple ID / Google account is enforced on their Penny Pilot
sign-in automatically, and Penny Pilot cannot weaken or bypass it. This is the
recommended pattern for consumer fintech (no first-party password store to phish).

**Attest?** Yes, on the basis of delegated/federated MFA. **Caveat to note in the
attestation:** MFA is provided by the identity providers, not enforced by a first-party
factor. If Plaid requires app-enforced step-up MFA specifically, that would be new work —
flag this wording with Plaid rather than over-claiming.

### 5. Robust MFA on internal systems that store or process consumer data

**Evidence:** [Password & MFA Policy](password-mfa-policy.md) (operator/admin section);
[Access Control Policy](access-control-policy.md).
Every internal system (GitHub, Supabase, Plaid dashboard, Apple, Google Cloud/Play, Expo)
requires MFA on a unique, password-manager-generated credential — authenticator app or
hardware key over SMS where supported. MFA enrollment on all admin accounts was confirmed
2026-07-05 (founder-attested) and is re-verified each review.

**Attest?** Yes.

### 6. Monitors EOL software and includes EOL in policy

**Evidence:** [End-of-Life Software Management](eol-software-management.md).
Software inventory with per-component EOL/support model and tracking source; practices for
6-month advance warning, no shipping on EOL runtimes, and store minimum-SDK deadlines. No
component is currently past end-of-support.

**Attest?** Yes.

### 7. Data deletion and retention policy

**Evidence:** [Data Retention & Deletion](data-retention-deletion.md); code —
`supabase/functions/delete-account/index.ts`, `src/app/auth.tsx`;
[Data Classification & Handling](data-classification-handling.md).
Per-category retention schedule and deletion SLAs, an in-app self-service account-deletion
action that revokes Plaid Items and cascade-deletes all data, plus on-device erase and an
email fallback. See Plaid questionnaire Q10.

**Attest?** Yes for retention + deletion. **Follow-up (not required for this attestation):**
a self-service in-app *data export* flow is still open.

### 8. Automated de-provisioning / modification of access for terminated or transferred employees

**Evidence:** [Employee Offboarding](employee-offboarding.md); [Access Control Policy](access-control-policy.md).
Penny Pilot has no employees today — there is no one to de-provision. The offboarding
checklist (revoke each named vendor account, rotate any shared secrets, remove repo/deploy
access) is written and ready to apply the moment a second person joins, at which point
named-account access makes revocation immediate and independent of the founder.

**Attest?** Yes — attest to the *policy and process being in place*; note that it is
currently not-applicable (zero employees) rather than actively running. Do not claim an
automated tool (e.g., an IdP with SCIM de-provisioning) is running, because none is yet.

### 9. Vulnerability scanning

**Evidence:** [Vulnerability Management](vulnerability-management.md).
GitHub Dependabot alerts enabled on `Mstolte02/penny-pilot` (2026-07-05); `npm audit` before
dependency upgrades; Expo/Supabase/Plaid/Apple/Google advisories reviewed on their triggers.

**Attest?** Yes. **Note:** automated dependency-update PRs (Dependabot version updates /
Renovate) and a third-party penetration test are documented follow-ups, not blockers for
this attestation.

### 10. Patches identified vulnerabilities within a defined SLA

**Evidence:** [Vulnerability Management](vulnerability-management.md) (triage table:
Critical same-day, High 7 days, Medium 30 days, Low opportunistic).
A defined, severity-based remediation SLA exists and has been exercised (the `xlsx` upgrade
that closed two high-severity advisories).

**Attest?** Yes.

### 11. Published privacy policy

**Evidence:** [Privacy Policy](../privacy-policy.md), hosted at
`https://penny-pilot.net/privacy` (`public/privacy/index.html`); linked from the in-app
consent gate. See Plaid questionnaire Q8.

**Attest?** Yes — confirm the hosted URL is live before signing.

## Before signing any attestation

A short pre-signature checklist so each "yes" above is true on the day it's signed:

1. Confirm `https://penny-pilot.net/privacy` is live and current (item 11).
2. Re-verify MFA is enrolled on every admin account in the
   [Password & MFA Policy](password-mfa-policy.md) table (items 4, 5).
3. Deploy migration `0003_consent_tracking.sql` and the `delete-account` Edge Function to
   the environment the attestation covers (items 2, 7), and set the
   `SUPABASE_SERVICE_ROLE_KEY` secret the function needs.
4. Confirm Dependabot alerts are still enabled (item 9).
5. For items 4 and 8, use the exact wording noted above (delegated MFA; policy-in-place /
   not-yet-applicable) so the attestation is accurate rather than aspirational.
