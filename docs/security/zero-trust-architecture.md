# Zero Trust Access Architecture

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Last reviewed:** 2026-07-19
**Stage:** Pre-launch / active development

## Purpose

Describes how Penny Pilot applies zero-trust principles — *never trust, always verify;
no implicit trust from network location* — to both consumer access to data and operator
access to infrastructure. This document exists to satisfy the Plaid remediation item
"implemented a zero trust access architecture" and should be read alongside the
[Access Control Policy](access-control-policy.md) and [Encryption Standards](encryption-standards.md).

## What "zero trust" means for an app this size

Penny Pilot has no corporate network, no VPN, and no trusted internal perimeter to defend —
there is nothing that is "inside." Every request to every system is authenticated and
authorized on its own merits, over the public internet, with TLS. That is zero trust by
construction rather than by retrofit. The controls below make that concrete.

## The five zero-trust tenets, mapped to Penny Pilot

### 1. Every request is authenticated — no anonymous data access

- **Consumer data:** the backend is Supabase Postgres with Row Level Security on every
  user-owned table (`supabase/migrations/0001_initial_schema.sql`). No row is returned
  without a valid `auth.uid()`, and a session can only ever reach rows where
  `user_id = auth.uid()`. There is no "service account" path from the mobile client that
  bypasses this.
- **Backend functions:** the Plaid Edge Functions
  (`supabase/functions/_shared/supabase.ts` → `getAuthenticatedClient`) reject any request
  without a valid `Authorization` bearer token and re-verify the user on every invocation.
  A network position alone (e.g., "the call came from our own app") grants nothing.

### 2. Authorization is least-privilege and per-resource

- The Supabase **anon key** shipped in the client can do nothing on its own — it is gated
  entirely by RLS (see [Access Control Policy](access-control-policy.md#service-role-and-secret-handling)).
- Privileged keys (Supabase **service-role**, Plaid **client secret**,
  `PLAID_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) exist **only** as Edge Function
  secrets, are never bundled into the app, and are used only by named functions for the
  single operation that needs them (e.g., `delete-account` uses the service role solely to
  delete the caller's own auth user).
- Writes that must not be user-controlled — `entitlements`, `plaid_items` — have no
  client-side write policy at all; they are writable only by trusted backend functions.

### 3. Verify explicitly, using strong identity

- End-user identity is federated to Apple and Google via OAuth PKCE
  (`src/services/supabase-client.ts`); Penny Pilot stores no passwords. MFA a user has on
  their Apple/Google account carries into Penny Pilot automatically
  (see [Password & MFA Policy](password-mfa-policy.md)).
- Every operator/admin system (GitHub, Supabase, Plaid, Apple, Google, Expo) requires
  MFA on a named account — no shared logins, no long-lived trusted devices treated as an
  identity.

### 4. Assume breach — limit blast radius

- Plaid access tokens are stored as ciphertext (application-level AES-256-GCM on top of
  database encryption per [Encryption Standards](encryption-standards.md)), so a database
  read alone — even an authorized one — yields no usable bank credential.
- RLS means a compromised client or a bug in the API layer cannot enumerate other users'
  data; the trust boundary is enforced in Postgres, not in application code.
- Session tokens on device live in the iOS Keychain / Android Keystore via
  `expo-secure-store`, not in general app storage.

### 5. Encrypt everywhere and verify continuously

- All traffic is TLS (client↔Supabase, Edge Functions↔Plaid). There is no unencrypted
  internal hop because there is no internal network.
- Access and secrets are re-verified at each [Risk Assessment Process](risk-assessment-process.md)
  review and whenever a vendor account or person changes.

## What is not yet in place (honest gaps)

- **Device posture / conditional access** (e.g., requiring a managed device for operator
  logins) is not implemented — appropriate for a solo operator, revisited when a second
  person joins.
- **Continuous session risk scoring** is delegated to the identity providers (Apple,
  Google, Supabase Auth) rather than implemented in-app.
- These gaps are tracked in the [Risk Assessment Process](risk-assessment-process.md) and
  will be reassessed before Penny Pilot moves real users onto production Plaid at scale.
