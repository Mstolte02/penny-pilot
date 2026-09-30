# End-of-Life (EOL) Software Management

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Last reviewed:** 2026-07-19
**Stage:** Pre-launch / active development

## Purpose

Describes how Penny Pilot tracks the support/end-of-life status of the software it depends
on, and what happens when a component approaches or reaches EOL. This satisfies the Plaid
remediation item "monitors end-of-life (EOL) software in use and updates policies to
include EOL management practices," and complements
[Vulnerability Management](vulnerability-management.md).

## Why EOL matters here

EOL software stops receiving security patches. Continuing to run it means known
vulnerabilities accumulate with no vendor fix — the single most predictable way an
otherwise-healthy app drifts into being insecure. Penny Pilot's dependency surface is
small and almost entirely managed platforms, which keeps this tractable for a solo team.

## Software inventory and EOL posture

Penny Pilot runs no self-managed servers or operating systems — the runtime is fully
managed (Supabase for the backend, Apple/Google for the OS, Expo/EAS for builds). The EOL
concerns are therefore the SDK/runtime versions the app pins and the managed platforms it
builds on.

| Component | Current version | EOL / support model | How EOL is tracked |
|---|---|---|---|
| Expo SDK | 56 (`package.json`) | Expo supports roughly the latest few SDKs; older SDKs lose build/OTA support | Expo SDK release notes & deprecation notices, reviewed each SDK upgrade |
| React Native | 0.85.x | Follows Expo SDK cadence | Bumped with the Expo SDK |
| React | 19.x | Upstream React release line | React release notes |
| Node.js (build/CI toolchain) | Active LTS | Node LTS schedule (each major EOL ~30 months) | nodejs.org release schedule at each toolchain review |
| TypeScript | ~6.0 | Rolling; no long-term EOL risk | Upgraded opportunistically |
| Supabase (Postgres + Auth + Edge Functions) | Managed | Supabase manages Postgres major-version upgrades and Deno runtime lifecycle | Supabase dashboard upgrade notices & changelog |
| Deno (Edge Functions runtime) | Managed by Supabase | Supabase-managed | Supabase advisories |
| Plaid API | Current | Plaid versions its API and announces deprecations | Plaid API changelog / deprecation emails |
| Apple iOS / Google Android (min & target) | Set in `app.json` / EAS | Apple/Google enforce minimum-SDK deadlines for store submissions | Reviewed at each App Store / Play submission |
| `xlsx` (SheetJS, CDN-pinned 0.20.3) | 0.20.3 | Community/vendor releases; pinned to a fixed known-good version | Watched via SheetJS advisories; already upgraded once for two high-severity CVEs |

## EOL management practices

1. **Inventory review cadence.** The table above is re-verified at each
   [Risk Assessment Process](risk-assessment-process.md) review (minimum annually) and
   whenever the Expo SDK is upgraded.
2. **Advance warning.** A component within **6 months** of a published EOL/support-end date
   is logged as an open item in the risk register with a planned upgrade date.
3. **No shipping on EOL runtimes.** Penny Pilot does not release a build on an Expo SDK,
   Node LTS, or Postgres major version that is already past vendor end-of-support. If an
   upgrade cannot land before EOL, the exposure is recorded as a time-boxed accepted risk
   per the [Information Security Policy](information-security-policy.md#exceptions) with a
   firm remediation date.
4. **Managed-platform reliance.** For Supabase-managed components (Postgres, Deno),
   penny Pilot's responsibility is to apply offered major-version upgrades within one review
   cycle of their availability rather than deferring indefinitely; Supabase owns the
   underlying patching.
5. **Store minimums.** Apple/Google minimum-SDK deadlines are treated as hard EOL dates for
   the corresponding build configuration and are handled at the submission that precedes the
   deadline.

## Current status

No component in the inventory above is currently past end-of-support. The nearest recurring
EOL pressure is the annual Expo SDK cadence and the Apple/Google store minimum-SDK
deadlines; both are handled on their normal upgrade cycles. This section is updated at each
review.
