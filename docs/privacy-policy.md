# Penny Pilot Privacy Policy

**Effective date:** July 5, 2026
**Contact:** markstolte02@gmail.com

Penny Pilot is a personal finance app operated by Mark Stolte ("we," "us"). This policy
describes what data the app handles, where it goes, and what your choices are. It's written
to be read, not skimmed past — it is short because the app collects little.

## The short version

- **You can use Penny Pilot without an account.** In that mode, everything — transactions
  you import or enter, budgets, goals — stays on your device. We never see it.
- If you **sign in** (with Apple or Google), your data syncs to our backend so it survives
  device changes. We store only what the app needs to work.
- If you **connect a bank** through Plaid, transaction and balance data flows from your
  bank to our backend via Plaid. We never see or store your bank username or password.
- We don't sell your data, we don't show ads, and we don't share your data with anyone
  except the service providers listed below who are required to run the app.

## What we collect, and when

**If you use the app without signing in:** nothing. Transactions you import from a
CSV/Excel file or enter by hand are parsed and stored on your device only. Deleting the
app (or using "Erase and start fresh" in settings) removes them.

**If you sign in with Apple or Google:**

- Your email address and display name, as shared by Apple or Google. (With Apple you can
  use "Hide My Email," and the app works fine with a relay address.)
- A user ID that ties your synced data to your account.
- The financial data you create or import in the app — transactions (merchant, amount,
  date, category), budgets, goals, and categorization rules — stored in our backend so it
  syncs across your devices.

**If you connect a bank account through Plaid:**

- Account metadata (institution name, account name, last-four mask, balances) and
  transaction history, provided by Plaid from your financial institution.
- Your bank sign-in credentials are entered directly with Plaid or your bank — **we never
  receive, see, or store them**. Plaid's handling of your data is described in
  [Plaid's End User Privacy Policy](https://plaid.com/legal/#end-user-privacy-policy).
- The credential Plaid issues us for ongoing sync (an "access token") is stored encrypted
  with an additional application-level key on top of database encryption.

**What we never collect:** your location, contacts, photos, browsing history, health data,
or payment card numbers. The app contains no advertising or cross-app tracking SDKs.

## How we use your data

Solely to provide the app's features: showing your transactions, suggesting categories,
building budgets, and projecting savings. Categorization and forecasting run on your data
alone — we do not currently use anyone's data to train models or build profiles across
users, and if that ever changes it will be disclosed here first, before it ships.

## Who we share data with

Only the service providers required to operate the app:

| Provider | Role | What they process |
|---|---|---|
| [Supabase](https://supabase.com/privacy) | Database, authentication, and backend hosting | Everything listed under "if you sign in" above |
| [Plaid](https://plaid.com/legal/#end-user-privacy-policy) | Bank connections | Your bank credentials (directly with your bank) and the account/transaction data it provides to us |
| Apple / Google | Sign-in | Your identity claims (email, name) when you choose them as your sign-in provider |

We may also disclose data if legally required to (for example, a valid subpoena). We have
never received such a request as of the effective date above.

We do not sell personal data and have not sold it in the past, as "sell" is defined under
the California Consumer Privacy Act (CCPA).

## Data retention and deletion

- **On-device data:** under your control. "Erase and start fresh" in settings deletes all
  locally stored data immediately; so does deleting the app.
- **Synced data:** kept as long as your account exists. To delete your account and all
  synced data, email markstolte02@gmail.com from the address associated with your account
  — deletion removes your profile and every dependent record (transactions, accounts,
  budgets, goals, bank connections), and we instruct Plaid to revoke any active bank
  connection. We aim to complete deletion requests within 30 days.
- **Bank connections:** to disconnect a bank without deleting your account, email us at
  the address above, or use [Plaid Portal](https://my.plaid.com) — Plaid's own tool that
  lets you view and revoke any app's connection to your bank directly.

## Security

Data in transit is encrypted with TLS. Synced data is protected by per-user database
access rules (your session can only ever read your own rows) and encrypted at rest; Plaid
access tokens carry an additional layer of application-level AES-256 encryption. Sign-in
sessions on your device are stored in the iOS Keychain / Android Keystore. No security is
perfect, but if we learn of a breach affecting your data, we will notify you directly at
the email on your account.

## Children

Penny Pilot is not directed at children under 13, and we do not knowingly collect data
from them. If you believe a child has created an account, contact us and we will delete it.

## Your rights

Depending on where you live (e.g., California, the EU/UK), you may have rights to access,
correct, export, or delete your personal data. Penny Pilot is small enough that there's no
form or portal — email markstolte02@gmail.com and a human (the developer) will handle it.

## Changes to this policy

If this policy changes materially, the effective date above will be updated and — for
signed-in users — the app will surface the change before it takes effect. The current
version is always at this URL.
