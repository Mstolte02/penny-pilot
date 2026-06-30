# Penny Pilot Technical Architecture

## App Layers

Penny Pilot should keep product logic independent from providers.

- `src/domain`: shared finance types and business vocabulary.
- `src/services/contracts.ts`: interfaces the app screens should depend on.
- `src/services/mock-finance-service.ts`: mock-backed implementation for prototype screens.
- `src/services/supabase-services.ts`: Supabase-backed implementation and backend function calls.
- `src/services/index.ts`: service registry selected by `EXPO_PUBLIC_DATA_SOURCE`.
- `supabase/migrations`: database schema and Row Level Security policies.

This lets the app keep moving with mock data while Supabase, Plaid, and AI services are wired in behind the same contracts.

## Environment

Use `.env.example` as the template.

- `EXPO_PUBLIC_DATA_SOURCE=mock`: prototype services.
- `EXPO_PUBLIC_DATA_SOURCE=supabase`: Supabase-backed services.
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key.

Only public client configuration belongs in Expo env vars. Plaid client secret, Plaid access tokens, AI provider keys, and subscription webhooks belong in backend functions.

## Core Backend Responsibilities

### Auth

Supabase Auth should own user identity.

V1 providers:

- Apple
- Google

Every finance table should be scoped by `user_id` and protected by Row Level Security.

### Plaid

Plaid secrets must never live in the Expo app.

Backend functions should handle:

- `create-link-token`
- `exchange-public-token`
- `sync-transactions`
- `refresh-item`
- `remove-item`

The app receives only safe client-facing responses. Plaid access tokens stay encrypted server-side in `plaid_items.access_token_ciphertext`.

### AI Categorization

AI categorization should be a backend service, not direct-from-device model calls.

Classifier order:

1. User merchant rules
2. Normalized merchant matching
3. Plaid category metadata
4. User category/subcategory plan
5. Backend AI fallback
6. Confidence scoring

High-confidence matches may be applied automatically later. Medium- and low-confidence matches should stay in the review queue.

### Forecasting

Forecasting should start simple and adapt:

1. Simple moving average for limited history
2. EWMA when behavior history is sufficient
3. Random walk with drift when trend matters
4. Backtesting to choose the lowest recent error model

Free users see friendly projections. Paid users may later see confidence ranges, model details, and scenario planning.

## First Integration Milestone

The first real milestone after the UI shell:

1. User completes setup preferences.
2. User signs in with Apple or Google.
3. User connects a Plaid sandbox institution.
4. Backend syncs transactions.
5. App creates starter categories/subcategories.
6. Transaction review queue uses categorization suggestions.
7. Budget is generated from fixed expenses, variable spending, and setup preferences.
8. Goals show first friendly projections.

## Open Implementation Questions

- Which Supabase environment naming convention should we use?
- How should Plaid tokens be encrypted in the final deployment?
- Should setup preferences be saved before sign-in locally, then migrated after auth?
- Which free-tier limits should be enforced in-app versus backend?
- How much anonymized categorization learning is acceptable for privacy and App Store disclosure?
