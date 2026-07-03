# Penny Pilot

Penny Pilot is a friendly personal finance app prototype built with Expo, in a warm penny-copper palette with light and dark modes (see `docs/design-system.md`). The app is 4 tabs + a center action: **Overview** (safe-to-spend + month-pace gauge), **Transactions** (quizlet-style review + subscriptions), **Can I afford this?** (center button), **Plan** (budget envelopes + goal destinations), and **Logbook** (drillable reports + net worth). Setup runs as Penny the Wizard before handing off to the everyday app; settings live behind Penny's avatar. Includes mock service boundaries, mascot assets, and a Supabase schema draft.

## Get started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

   Keep `EXPO_PUBLIC_DATA_SOURCE=mock` until a real Supabase project is ready.

3. Start the app:

   ```bash
   npm run web
   ```

## Data Modes

The app uses a switchable service registry in `src/services/index.ts`.

- `mock`: uses in-app prototype data and mock services.
- `supabase`: uses Supabase client services and backend function stubs.

To switch to Supabase mode:

```bash
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Plaid and AI secrets must live in backend functions, never in the Expo app.

## Transaction Setup

Penny Pilot supports two intended transaction paths:

- Bank sync: connect an account through Plaid for automatic transaction updates.
- Private bank export: download CSV/XLS/XLSX transactions from a bank or credit card website and import them without linking a live account.

Both paths should feed the same review queue so users can approve or correct Penny's category guesses.

## Useful Files

- Product brief: `docs/penny-pilot-v1-brief.md`
- Technical architecture: `docs/technical-architecture.md`
- Domain model: `src/domain/finance.ts`
- Service contracts: `src/services/contracts.ts`
- Mock services: `src/services/mock-finance-service.ts`
- Supabase services: `src/services/supabase-services.ts`
- Supabase schema draft: `supabase/migrations/0001_initial_schema.sql`

## Checks

```bash
npm run lint
npx tsc --noEmit
```

## Near-Term Build Path

1. Create Supabase project and apply the schema.
2. Configure Apple and Google auth.
3. Implement Plaid Edge Functions.
4. Swap selected screens from sample data to `financeDataService`.
5. Add Expo development build for native Plaid Link.
