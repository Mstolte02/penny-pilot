# Logging & Monitoring

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Last reviewed:** 2026-07-05
**Stage:** Pre-launch / active development

## Purpose

States what Penny Pilot currently observes about its own systems, what it deliberately does
not log, and what monitoring gaps exist while the app is pre-launch.

## What's logged today

| Source | What it captures | Access |
|---|---|---|
| Supabase Auth logs | Sign-in events, token refresh, provider (Apple/Google) errors | Supabase project dashboard (founder only) |
| Supabase Postgres logs | Query errors, slow queries | Supabase project dashboard (founder only) |
| Supabase Edge Function logs (`plaid-create-link-token`, `plaid-exchange-public-token`, `plaid-sync-transactions`) | Request handling, Plaid API errors, thrown exceptions | Supabase project dashboard (founder only) |
| Expo/EAS build logs | Build success/failure, native build warnings | Expo/EAS dashboard (founder only) |
| Client-side console warnings (development only) | React/Expo runtime warnings during local development (e.g., surfaced via the browser dev preview) | Local machine only; not collected or transmitted from end-user devices |

## What is deliberately never logged

- Full Plaid access tokens, in either plaintext or ciphertext form, are not written to
  application logs — Edge Functions reference stored Plaid items by their database `id`,
  not by token value.
- The Plaid token-encryption key and other Edge Function secrets are never logged or
  printed.
- Raw transaction detail is not intentionally logged beyond what Supabase/Plaid's own
  request logging captures as part of normal API operation; application code should log
  identifiers (transaction id, user id) rather than merchant/amount detail when debugging.

## What's not in place yet

- **No centralized log aggregation or SIEM.** Logs are viewed per-vendor (Supabase
  dashboard, Expo dashboard) rather than in one place. Appropriate for the current scale
  and user count (effectively pre-launch), but a real gap once there's a production user
  base to protect.
- **No automated alerting** on security-relevant signals — e.g., a spike in failed sign-ins,
  Edge Function error rate, or Plaid `ITEM_LOGIN_REQUIRED`/reconnect events. These are
  currently only visible if manually checked in the Supabase dashboard.
- **No anomaly detection** on access patterns (e.g., a single account's data being read
  from an unusual location or at unusual volume).

## Planned improvements (before scaling past pre-launch)

1. Enable Supabase log drains or scheduled alerts for Edge Function error-rate spikes and
   repeated Auth failures.
2. Add an explicit alert on Plaid item status transitioning to `needs-reconnect` or
   `error` in bulk (could indicate either a Plaid-side incident or a problem in the sync
   function), building on the `status` column already present on `plaid_items`.
3. Define a minimum retention period for security-relevant logs once a log aggregation
   solution is chosen, rather than relying on each vendor's default retention window.

## Retention

Log retention today follows each vendor's default retention for the current plan tier
(Supabase, Expo/EAS) — not independently configured or extended. This is noted as a
baseline to revisit once compliance or investigative needs require a longer window.
