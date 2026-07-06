# App Store Connect — App Privacy Label Answers

**For:** App Store Connect → Penny Pilot → App Privacy questionnaire
**Prepared:** 2026-07-05
**Basis:** [docs/security/data-classification-handling.md](security/data-classification-handling.md) and the current codebase.

Apple's definition of "collect" is **transmitted off the device**. Penny Pilot's local-only
mode (no sign-in, CSV import) transmits nothing, so it doesn't count as collection — the
answers below cover what happens when a user signs in and/or links a bank, since the
label must describe the app's full capability.

> **Re-check this document when anything changes:** adding crash reporting (Sentry),
> analytics, or an AI categorization backend all change these answers, and the label must
> be updated in App Store Connect *before* the build using them ships.

## Question 1: "Do you or your third-party partners collect data from this app?"

**Answer: Yes.** (Sign-in identity + synced financial data go to Supabase; bank data
flows via Plaid.)

## Question 2: Data types collected

Select exactly these:

| ASC Category | ASC Data Type | Collected? | Why |
|---|---|---|---|
| Contact Info | Email Address | **Yes** | From Apple/Google sign-in, stored in `profiles` |
| Contact Info | Name | **Yes** | Display name from the OAuth provider, stored in `profiles` |
| Financial Info | Other Financial Info | **Yes** | Transactions, balances, budgets, goals synced to Supabase; bank data via Plaid |
| Identifiers | User ID | **Yes** | Supabase auth user ID ties synced records to the account |
| Everything else (Location, Contacts, Photos, Health & Fitness, Browsing History, Search History, Purchases*, Usage Data, Diagnostics, etc.) | — | **No** | Not collected; no analytics or crash SDK is integrated as of this writing |

*"Purchases" in Apple's taxonomy means the user's purchase history collected as data — bank
transactions belong under Other Financial Info, not Purchases.

**Note on Diagnostics:** if Sentry (or any crash reporter) is added before the beta build
— which is recommended — add **Diagnostics → Crash Data** (and **Performance Data** if
enabled), typically "not linked to identity, not used for tracking, App Functionality."

## Question 3: Per-type usage, linkage, and tracking

For **each** of the four collected types (Email Address, Name, Other Financial Info,
User ID), answer:

- **What is it used for?** → **App Functionality** only. (Do not select Analytics,
  Product Personalization, Advertising, or Other — none apply.)
- **Is it linked to the user's identity?** → **Yes.** (All four are keyed to the account;
  claiming otherwise would be wrong.)
- **Is it used for tracking?** → **No.** ("Tracking" is Apple's term for cross-app/site
  advertising or data-broker sharing. Penny Pilot has no ad SDKs and shares nothing with
  data brokers, so no App Tracking Transparency prompt is needed.)

## Privacy policy URL field

`https://penny-pilot.net/privacy` (source: [docs/privacy-policy.md](privacy-policy.md),
hosted from `public/privacy/index.html`).

## Consistency requirements (so the label doesn't get the app rejected)

1. The label, the privacy policy, and the actual network behavior must agree. Today they
   do; the biggest future risk is adding an SDK that phones home without updating this.
2. Apple guideline 5.1.1(v): apps that support **account creation must support in-app
   account deletion**. Penny Pilot currently handles deletion by email request (as stated
   in the privacy policy), which does **not** satisfy 5.1.1(v) for App Store release —
   an in-app "Delete account" action (delete `profiles` row + Plaid `/item/remove`) must
   ship before public App Store release. TestFlight beta review is more lenient, but plan
   this as a pre-launch requirement, not an optional item. Tracked in the security risk
   register.
3. The Plaid data flow must be represented (it is, under Other Financial Info) even
   though Plaid is a third party — Apple's questionnaire covers "you or your third-party
   partners."
