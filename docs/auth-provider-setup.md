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

Apple is more involved and should come after Google works.

In Apple Developer:

1. Join/confirm Apple Developer Program membership.
2. Create the app Bundle ID.
3. Enable Sign in with Apple.
4. Create the Services ID and private key required by Supabase.

In Supabase:

1. Open **Authentication > Providers > Apple**.
2. Enable Apple.
3. Add the Apple credentials.
4. Save.

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
