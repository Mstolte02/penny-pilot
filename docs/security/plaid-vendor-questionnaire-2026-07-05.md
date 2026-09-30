# Plaid Vendor Security Questionnaire — Responses

**Submitted by:** Mark Stolte, Founder — markstolte02@gmail.com
**Date:** 2026-07-05
**Basis for answers:** current codebase (`Mstolte02/penny-pilot`), the policy set in
`docs/security/`, and direct confirmation from the founder on items not visible in code
(admin-account MFA status, device security practices).

Answers are written to be accurate about a pre-launch, single-founder company, including
saying "not yet" where that's the honest answer. See `docs/security/README.md` for
organizational context.

---

### 1. Documented information security policy, operationalized to identify/mitigate/monitor risk

**Yes.** See [`information-security-policy.md`](information-security-policy.md) and the
full policy set it indexes in [`README.md`](README.md):

- [Access Control Policy](access-control-policy.md)
- [Password & MFA Policy](password-mfa-policy.md)
- [Data Classification & Handling](data-classification-handling.md)
- [Encryption Standards](encryption-standards.md)
- [Secure Software Development Lifecycle](secure-software-development-lifecycle.md)
- [Vulnerability Management](vulnerability-management.md)
- [Incident Response Plan](incident-response-plan.md)
- [Business Continuity & Disaster Recovery](business-continuity-disaster-recovery.md)
- [Logging & Monitoring](logging-monitoring.md)
- [Vendor Risk Management](vendor-risk-management.md)
- [Employee Offboarding](employee-offboarding.md)
- [Risk Assessment Process](risk-assessment-process.md)

These were authored and first reviewed 2026-07-05, sized to a one-person team, and state
plainly which controls are already operating versus planned with a target date — rather
than describing an enterprise program that doesn't exist yet. The
[Risk Assessment Process](risk-assessment-process.md) is the mechanism by which risks are
identified and tracked going forward (it includes a live risk register with target dates).

### 2. Access controls in place to limit access to production assets and sensitive data

*(select all that apply — answered per item, since several are partial)*

| Control | Status |
|---|---|
| A defined and documented access control policy | **Yes** — [access-control-policy.md](access-control-policy.md). |
| RBAC | **No.** Team of one; there's no multi-role staff permission model yet. End-user data isolation is enforced differently — via Postgres Row Level Security scoped to `auth.uid()` on every user-owned table — which prevents cross-user access but isn't role-based access control for staff. RBAC among staff is planned for when a second person joins. |
| Periodic access reviews and audits | **Yes, self-conducted.** [Access Control Policy](access-control-policy.md) defines a review cadence (on any role/vendor change, and at minimum annually). This is founder self-review today, not an independent third-party audit. |
| Automated de-provisioning/modification of access for terminated/transferred employees | **No.** [Employee Offboarding](employee-offboarding.md) defines a manual checklist, since there are no employees/contractors yet to de-provision. Automation is not built because there's nothing to automate against today; it will be evaluated once there's a second person with access. |
| Zero trust access architecture | **Not formally.** Every backend request (Edge Functions, Postgres via RLS) is authenticated per-request using a Supabase-issued JWT regardless of network origin — no implicit trust based on network location — but this hasn't been implemented or documented as a named Zero Trust program. |
| Centralized identity and access management solution | **Partial.** For end users: yes — Supabase Auth is the single, centralized identity provider (via Apple/Google OAuth). For internal/admin access to infrastructure (GitHub, Supabase dashboard, Plaid dashboard, Google Cloud/Play Console), no — each is a separate vendor login today, which is a gap for when the team grows past one person. |
| Use of OAuth tokens or TLS certificates for non-human authentication | **Yes.** Every Supabase Edge Function requires a valid Supabase-issued JWT on the Authorization header (`supabase/functions/_shared/supabase.ts`); all calls to Plaid's API happen server-side over TLS. No service-to-service call in this system relies on a shared static secret alone without TLS. |

### 3. MFA for consumers on mobile/web before Plaid Link is surfaced

**Authentication is required and backend-enforced before Plaid Link can open; a separate,
Penny-Pilot-specific MFA challenge is not layered on top of that.**

Concretely: `plaid-create-link-token` (the function that must succeed before the Plaid Link
SDK can be opened on-device) requires a valid Supabase session and throws "Sign in before
connecting a bank" otherwise (`supabase/functions/_shared/supabase.ts`,
`supabase/functions/plaid-create-link-token/index.ts`). Sign-in itself is exclusively via
Apple or Google OAuth — Penny Pilot has no password of its own to protect. Any MFA a user
has enabled on their Apple ID or Google Account applies transitively to this sign-in, since
Penny Pilot never sees or bypasses that provider's own authentication flow. Penny Pilot
does not currently add an additional, separate MFA prompt of its own before opening Plaid
Link.

### 4. MFA for access to critical systems that store/process consumer financial data

**Not fully confirmed as of this review.** Policy requires MFA on every admin system that
can reach consumer financial data — GitHub, the Supabase dashboard, the Plaid dashboard,
and Google Cloud/Play Console (see [Password & MFA Policy](password-mfa-policy.md)) — but
as the sole operator, the founder has not verified enrollment is actually turned on across
all of them. This is the single highest-priority action item coming out of this review:
enabling MFA on all four is a same-day fix with no dependencies, and is being done as a
direct follow-up to this questionnaire rather than left as a stated policy with unverified
practice.

### 5. TLS 1.2+ encryption in transit between clients and servers

**Yes.** All communication with Supabase (Postgres via PostgREST, Auth, Edge Functions) and
with Plaid's API happens over HTTPS/TLS via those vendors' SDKs/endpoints; the codebase
contains no cleartext HTTP backend calls. Plaid Link's OAuth redirect also uses an HTTPS
Universal Link rather than a custom URL scheme, per Plaid's own OAuth requirement. See
[Encryption Standards](encryption-standards.md).

### 6. Encryption at rest for consumer data received from the Plaid API

**Partially — the token is field-level encrypted; the broader synced data relies on
platform-level encryption, not application-layer field encryption.** Specifically:

- The Plaid **access token** itself — the single most sensitive value — is encrypted with
  **AES-256-GCM** using an application-managed key (`PLAID_TOKEN_ENCRYPTION_KEY`) that
  exists only as a Supabase Edge Function secret, before being written to
  `plaid_items.access_token_ciphertext` (`supabase/functions/_shared/plaid.ts`). It is
  never stored or transmitted in plaintext outside the exchange step.
- The **transaction and account data** Plaid returns (merchant, amount, balances,
  institution/account metadata) is stored in Supabase Postgres and protected by (a)
  Supabase's platform-level storage encryption at rest, per Supabase's own documented
  infrastructure, and (b) Row Level Security limiting reads to the owning user — but it
  does not have a separate application-layer field encryption on top of that, the way the
  access token does. See [Data Classification & Handling](data-classification-handling.md)
  and [Encryption Standards](encryption-standards.md) for the full breakdown by field.

### 7. Vulnerability scanning of employee/contractor machines and production assets

**Not yet on either surface, with one important caveat: there are no self-managed
production servers to scan.** All production infrastructure (Postgres, Auth, Edge
Functions) runs on Supabase's managed platform — there is no Penny-Pilot-operated VM,
container host, or bare-metal instance to run a vulnerability scanner against; scanning
the underlying platform is Supabase's responsibility as the infrastructure provider. On the
founder's development machine, no dedicated endpoint-protection or vulnerability-scanning
tool is confirmed in place today — only default OS protections are assumed, unverified.

**Practices actually in place today** (select-all-that-apply, answered honestly):

- [x] Dependency / software-composition-analysis scanning — GitHub Dependabot security
      alerts (enabled 2026-07-05 as part of this review) plus ad hoc `npm audit`.
- [ ] Endpoint protection / vulnerability scanning tool on developer machines — not
      confirmed; action item to enable full-disk encryption and confirm automatic OS
      security updates on the development machine as an immediate, low-cost fix.
- [ ] Network/infrastructure vulnerability scanning of production assets — not applicable
      today (no self-managed servers); inherited from Supabase's platform security.
- [ ] Scheduled third-party penetration test — not yet performed; planned before
      production users are onboarded at scale.

### 8. Privacy policy for the application where Plaid Link will be deployed

**Published.** The privacy policy ([docs/privacy-policy.md](privacy-policy.md), hosted at
`https://penny-pilot.net/privacy`) covers what's collected, Plaid's role, retention, and
user rights. It is linked from the first-run consent gate (see item 9).

### 9. Consent for collection, processing, and storage of consumer data

**Implemented as of 2026-07-19** (update to the 2026-07-05 baseline below). Penny Pilot now
captures its own explicit, versioned consent:

- A first-run **consent gate** (`src/components/consent-gate.tsx`) blocks app use until the
  user affirmatively agrees to the Privacy Policy for the current consent version.
- Agreement is recorded locally (so it holds in the no-account, on-device mode) and
  mirrored to an immutable, versioned **server-side audit trail** (`user_consents` table,
  `supabase/migrations/0003_consent_tracking.sql`) whenever a session exists.
- A **Plaid-specific data-sharing acknowledgment** is shown before Plaid Link opens
  (`src/components/bank-link-button.native.tsx`) and recorded as its own consent type.
- Consent version is bumped in `src/constants/consent.ts` when the substance changes,
  re-prompting all users and preserving the prior record in the trail.

*Original 2026-07-05 baseline:* Plaid Link and Apple/Google presented their own consent
panels, but Penny Pilot captured no consent of its own — the gap now closed above.

### 10. Data deletion/retention policy compliant with applicable privacy laws, reviewed periodically

**Largely implemented as of 2026-07-19.** There is now a dedicated
[Data Retention & Deletion](data-retention-deletion.md) policy with a per-category retention
schedule and deletion SLAs, on top of the cascade behavior documented in
[Data Classification & Handling](data-classification-handling.md). Status of the three gaps
disclosed in the 2026-07-05 baseline:

1. **Closed.** Account deletion now runs through the `delete-account` Edge Function
   (`supabase/functions/delete-account/index.ts`), which calls Plaid `/item/remove` for
   every connected Item before deleting the `auth.users` row (cascading all data). An
   in-app "Delete account" action drives it (`src/app/auth.tsx`).
2. **Closed for the schedule; law-specific mapping ongoing.** The retention schedule now
   exists as a standalone document; explicit line-by-line mapping to individual statutes
   (CCPA/GLBA/state) is a documentation refinement tracked for the pre-production review.
3. **Open.** A self-service, in-app **data export** flow is not yet built (deletion is);
   this remains the one open sub-item, tracked in the
   [Risk Assessment Process](risk-assessment-process.md) register.

---

## Follow-up actions opened by this questionnaire

Tracked in [Risk Assessment Process](risk-assessment-process.md)'s risk register; the two
most urgent, both same-day fixes:

1. **Enable MFA now** on GitHub, the Supabase dashboard, the Plaid dashboard, and Google
   Cloud/Play Console — currently unverified, addressed directly by question 4 above.
2. **Enable full-disk encryption (FileVault) and confirm automatic OS security updates**
   on the development machine — addresses question 7's device-security gap at effectively
   no cost.

Larger, pre-production-launch items: publish a privacy policy, add an in-app consent step,
and implement Plaid item revocation + a real retention schedule on account deletion
(questions 8–10).
