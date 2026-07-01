# Plaid Sandbox Setup

Penny Pilot keeps Plaid secrets in Supabase Edge Functions. The mobile app only asks Supabase for a short-lived Link token.

## 1. Plaid Dashboard

Create a Plaid account and use Sandbox first.

Add these app identifiers in Plaid when you are ready to test native OAuth flows:

- iOS bundle identifier: `com.pennypilot.finance`
- Android package name: `com.pennypilot.finance`
- OAuth redirect URI: `https://penny-pilot.net/plaid/oauth`

Plaid OAuth redirect URIs must use HTTPS. On iOS/React Native this HTTPS URL must
be configured as a Universal Link for the app. Custom URI schemes such as
`pennypilot://plaid/oauth` are not supported for Plaid OAuth.

For iOS Universal Links, host these files on the same HTTPS domain:

- `/.well-known/apple-app-site-association`
- `/plaid/oauth`

The local copies live in `public/.well-known/apple-app-site-association` and
`public/plaid/oauth/index.html`.

## 2. Supabase Secrets

Set these secrets in Supabase:

```sh
supabase secrets set PLAID_CLIENT_ID=your_client_id
supabase secrets set PLAID_SECRET=your_sandbox_secret
supabase secrets set PLAID_ENV=sandbox
supabase secrets set PLAID_PRODUCTS=transactions
supabase secrets set PLAID_COUNTRY_CODES=US
supabase secrets set PLAID_REDIRECT_URI=https://penny-pilot.net/plaid/oauth
supabase secrets set PLAID_ANDROID_PACKAGE_NAME=com.pennypilot.finance
```

Generate an encryption key for Plaid access tokens:

```sh
openssl rand -base64 32
supabase secrets set PLAID_TOKEN_ENCRYPTION_KEY=the_generated_value
```

## 3. Deploy Functions

Deploy the three functions:

```sh
supabase functions deploy plaid-create-link-token
supabase functions deploy plaid-exchange-public-token
supabase functions deploy plaid-sync-transactions
```

## 4. Native Build

Plaid Link uses native code, so it will not open inside Expo Go or the web build.

Use an EAS development build. The iOS Associated Domains entitlement is native,
so changing the Universal Link domain requires a fresh iOS build:

```sh
eas build --profile development-device --platform ios
```

After installing the development build on a simulator or device, run:

```sh
npx expo start --dev-client
```
