# Auth Provider Setup

## Current App Values

- Supabase URL: `https://mvoanryyhhswrxhedbtl.supabase.co`
- App scheme: `pennypilot`
- Local web callback: `http://localhost:8081/auth/callback`
- Native callback: `pennypilot://auth/callback`
- Supabase OAuth callback for provider dashboards: `https://mvoanryyhhswrxhedbtl.supabase.co/auth/v1/callback`

## Supabase URL Configuration

In Supabase:

1. Open **Authentication**.
2. Open **URL Configuration**.
3. Set **Site URL** for local development:
   - `http://localhost:8081`
4. Add redirect URLs:
   - `http://localhost:8081/auth/callback`
   - `pennypilot://auth/callback`

When we add EAS development builds and production domains, add those callback URLs too.

## Google Provider

In Google Cloud:

1. Create or select a Google Cloud project.
2. Configure OAuth consent screen.
3. Create OAuth credentials for a web application.
4. Add authorized redirect URI:
   - `https://mvoanryyhhswrxhedbtl.supabase.co/auth/v1/callback`
5. Copy the Google Client ID and Client Secret.

In Supabase:

1. Open **Authentication > Providers > Google**.
2. Enable Google.
3. Paste the Google Client ID and Client Secret.
4. Save.

## Apple Provider

The app code is already complete — `signInWithApple` uses the same Supabase PKCE browser
flow as Google (`src/services/supabase-services.ts`), so this is configuration only.
App Store guideline 4.8 requires Sign in with Apple to *work* (not just render a button)
in any build that offers Google sign-in, so finish this before submitting to review.

### Apple Developer portal (developer.apple.com/account)

1. **App ID capability:** Certificates, Identifiers & Profiles → **Identifiers** → open
   `com.pennypilot.finance` → check **Sign in with Apple** → Save.
2. **Services ID** (this is the OAuth client for the browser-based flow the app uses):
   Identifiers → **+** → **Services IDs** → identifier `com.pennypilot.finance.web`
   (must differ from the App ID), description "Penny Pilot Sign In" → Register.
3. Open the new Services ID → check **Sign in with Apple** → **Configure**:
   - Primary App ID: `com.pennypilot.finance`
   - Domains: `mvoanryyhhswrxhedbtl.supabase.co`
   - Return URLs: `https://mvoanryyhhswrxhedbtl.supabase.co/auth/v1/callback`
   - Save.
4. **Private key:** **Keys** → **+** → name "Penny Pilot SIWA" → check
   **Sign in with Apple** → Configure → Primary App ID `com.pennypilot.finance` →
   Register → **Download the `.p8` file** (Apple only lets you download it once — store
   it in your password manager, never commit it; `.p8` is already git-ignored). Note the
   **Key ID** shown on that page and your **Team ID** (top-right of the portal).

### Generate the client secret

Apple doesn't hand you a client secret like Google does — it's a JWT you sign yourself
with the `.p8` key. Use the zero-dependency script in this repo:

```sh
node scripts/generate-apple-client-secret.mjs \
  --key ~/path/to/AuthKey_XXXXXXXXXX.p8 \
  --key-id XXXXXXXXXX \
  --team-id YOURTEAMID \
  --services-id com.pennypilot.finance.web
```

⚠️ **The secret expires after 180 days (Apple's maximum).** Set a calendar reminder to
re-run the script and update Supabase before then — expiry fails silently as broken
Apple sign-in. (Never paste the `.p8` into a web-based JWT generator; it's the private
key to your sign-in identity.)

### Supabase dashboard

1. Open **Authentication → Providers → Apple** and enable it.
2. **Client IDs:** `com.pennypilot.finance.web,com.pennypilot.finance` (the Services ID
   first — that's what the browser flow presents; the bundle ID is included so a future
   native `expo-apple-authentication` flow works without reconfiguring).
3. **Secret Key (for OAuth):** paste the JWT from the script.
4. Save, then test on web (`/auth` → Continue with Apple) and in an EAS dev build.

Note: users may choose Apple's **Hide My Email**, so `profiles.email` can be a
`@privaterelay.appleid.com` address — the app treats it like any other email.

## App Mode Switch

The app currently stays in mock mode:

```bash
EXPO_PUBLIC_DATA_SOURCE=mock
```

After Google provider setup works, switch to:

```bash
EXPO_PUBLIC_DATA_SOURCE=supabase
```

Then restart the Expo dev server so the env value is reloaded.
