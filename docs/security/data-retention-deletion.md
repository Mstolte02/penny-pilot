# Data Retention & Deletion Policy

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Last reviewed:** 2026-07-19
**Stage:** Pre-launch / active development

## Purpose

Defines how long Penny Pilot keeps each kind of data, how it is deleted, and the timelines
for honoring deletion requests. This satisfies the Plaid remediation item "implemented a
data deletion and retention policy" and is the operational companion to the deletion
commitments in the [Privacy Policy](../privacy-policy.md) and the tiers in
[Data Classification & Handling](data-classification-handling.md).

## Guiding principle

Penny Pilot retains the **minimum data needed to provide the app**, for **only as long as
the account that owns it exists**, and gives users a **self-service way to delete
everything**. There is no secondary use (no ad profiles, no model training, no data sales),
so there is no reason to retain data beyond the account's life.

## Retention schedule

| Data | Where it lives | Retention | Deletion trigger |
|---|---|---|---|
| On-device data (no account): transactions, budgets, goals, imports | The device only | Until the user erases it or removes the app | "Erase and start fresh" (`src/app/auth.tsx`) or app deletion — immediate |
| Profile (email, display name, user id) | Supabase `profiles` | Life of the account | Account deletion |
| Financial records: transactions, accounts, categories, budgets, goals, merchant rules, forecasts | Supabase (user-owned tables) | Life of the account | Account deletion (cascade) |
| Plaid Item + encrypted access token | Supabase `plaid_items` | Until the bank is disconnected or the account is deleted | Disconnect request, or account deletion — token also revoked at Plaid |
| Consent records | Supabase `user_consents` | Life of the account (immutable audit trail while it exists) | Account deletion (cascade) |
| Auth session tokens | Device Keychain/Keystore | Until sign-out or session expiry | Sign-out, account deletion |
| Backend logs / operational telemetry | Supabase platform defaults | Per Supabase's retention (short-lived) | Aged out by the platform |

Penny Pilot keeps **no independent backups outside Supabase's managed
point-in-time-recovery window** (see [Business Continuity & Disaster Recovery](business-continuity-disaster-recovery.md)); deleted data ages out of that PITR window on
Supabase's standard schedule and is not separately archived by Penny Pilot.

## How deletion works

### Self-service, in-app (primary path)

- **On-device data:** Settings → *Start fresh* → "Erase and start fresh" clears all locally
  stored data immediately.
- **Full account deletion:** Settings → *Delete account* → "Delete my account" (visible when
  signed in). This calls the `delete-account` Edge Function
  (`supabase/functions/delete-account/index.ts`), which:
  1. Revokes every connected Plaid Item at Plaid (`/item/remove`), so no further bank data
     can be pulled.
  2. Deletes the user's `auth.users` row with the service role, which **cascades** through
     `profiles` to every dependent table (transactions, accounts, budgets, goals, consents,
     `plaid_items`) via the `ON DELETE CASCADE` foreign keys in
     `supabase/migrations/0001_initial_schema.sql`.
  3. Ends the local session.
  This is effectively immediate; the residual copy in Supabase's PITR window ages out on
  the platform schedule.

### By request (fallback)

- Users can also email **markstolte02@gmail.com** from their account address to request
  deletion, or use [Plaid Portal](https://my.plaid.com) to revoke Penny Pilot's bank
  connection directly.

## Service-level timelines

| Request | Target |
|---|---|
| In-app account deletion | Immediate (synchronous); Plaid revocation best-effort within the same call |
| Emailed deletion request | Acknowledged within 7 days, completed within **30 days** |
| Bank-disconnect request | Completed within 7 days (or immediately via Plaid Portal) |

## Retention exceptions

The only reason data would be retained past a deletion request is a specific legal
obligation (e.g., a preservation order). None exist as of the review date above. Any such
exception would be documented, time-boxed, and limited to the specific records named, per
the [Information Security Policy](information-security-policy.md#exceptions).

## Review

This policy is reviewed whenever the data model changes materially (a new table, a new
vendor, a new data use) and at minimum annually via the
[Risk Assessment Process](risk-assessment-process.md).
