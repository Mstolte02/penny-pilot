# Security Policy

Penny Pilot is a personal finance app that connects to Plaid (bank data) and Supabase
(auth/database/backend functions). This file is what GitHub surfaces under the repository's
**Security** tab. The full policy set — access control, encryption standards, incident
response, vendor risk, and more — lives in [`docs/security/`](../docs/security/README.md)
and is reviewed at minimum annually (see
[`docs/security/risk-assessment-process.md`](../docs/security/risk-assessment-process.md)).

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public issue —
this repository is private, but the product handles financial data, so responsible
disclosure still matters.

- **Email markstolte02@gmail.com** with a description of the issue, steps to reproduce, and
  its potential impact. This is the reliable channel today.
- If this repository's Security tab shows a "Report a vulnerability" option, GitHub's
  private vulnerability reporting is also available and opens a private draft security
  advisory visible only to the maintainer — enabling that feature via GitHub's API returned
  a 404 as of this writing, which may mean it needs to be turned on manually in
  **Settings → Security → Private vulnerability reporting**, or that it isn't available on
  the current plan for a private repository. Email is the guaranteed path either way.

Penny Pilot is currently a single-founder project (see
[`docs/security/information-security-policy.md`](../docs/security/information-security-policy.md)
for what that means for response capacity). There is no on-call rotation or contractual SLA
today; the practical targets used internally are documented in
[`docs/security/vulnerability-management.md`](../docs/security/vulnerability-management.md)
(same-day best-effort for actively-exploited/critical issues, 7 days for high severity).
You'll get an acknowledgment as soon as the report is seen, and a real update once it's
triaged — not silence.

Please do not test for vulnerabilities against real user accounts or production Plaid/
Supabase data; use a Sandbox Plaid item and your own test account.

## Supported versions

Penny Pilot ships as a single, continuously updated mobile app rather than a versioned
library — there are no older major versions receiving separate security patches. Fixes land
on `main` and go out in the next app store release (or the next OTA update, for changes
that don't require a native rebuild).

## Scope

In scope: this repository's application code, Supabase Edge Functions
(`supabase/functions/`), and database migrations (`supabase/migrations/`). Out of scope:
vulnerabilities in Plaid's, Supabase's, Apple's, or Google's own platforms — please report
those directly to the vendor (see
[`docs/security/vendor-risk-management.md`](../docs/security/vendor-risk-management.md)
for the full vendor list).
