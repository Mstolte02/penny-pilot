# MFA Setup Instructions — Critical Systems

**For:** Mark Stolte
**Purpose:** Close the open risk-register item "MFA not confirmed enabled on
GitHub/Supabase/Plaid/Google admin dashboards" ([risk-assessment-process.md](../risk-assessment-process.md)),
and produce evidence screenshots for Plaid questionnaire Q4.

**Before you start:** install an authenticator app on your phone if you don't have one —
Google Authenticator, 1Password, or Apple's built-in Passwords app (Settings → Passwords →
select a login → Set Up Verification Code) all work. Use the authenticator-app option
everywhere below; avoid SMS where the vendor offers a choice, since SMS is vulnerable to
SIM-swap attacks. **Save the recovery codes each vendor shows you** — put them in your
password manager, not a screenshot folder. Without them, losing your phone can lock you
out of the account permanently.

Estimated total time: ~20 minutes for all five.

---

## 1. GitHub (source code)

1. Go to <https://github.com/settings/security> (Settings → Password and authentication).
2. Under **Two-factor authentication**, click **Enable two-factor authentication**.
3. Choose **Authenticator app**, scan the QR code with your authenticator, enter the
   6-digit code.
4. **Download the recovery codes** when prompted and store them in your password manager.
5. *(Optional but recommended)* Add a passkey as a second method on the same page.

**Evidence screenshot:** the same settings page after setup, showing
"Two-factor authentication · Enabled". Crop out recovery codes if visible.

## 2. Supabase (database, auth, Edge Function secrets — highest priority)

This account can read every user's data and the Plaid token-encryption key, so if you only
do one today, do this one.

1. Go to <https://supabase.com/dashboard/account/security> (Account → Security).
2. Under **Multi-factor authentication**, click **Add authenticator app** (Supabase calls
   it an "MFA factor").
3. Scan the QR code, enter the code, and name the factor (e.g., "Mark's phone").
4. If you signed up for Supabase via GitHub OAuth rather than email/password, your
   Supabase login is only as strong as your GitHub login — step 1 above then protects
   this too, but still add the Supabase-level factor; it applies to dashboard actions
   independently.

**Evidence screenshot:** the Security page showing the enrolled MFA factor.

## 3. Plaid dashboard (bank-data API credentials)

1. Go to <https://dashboard.plaid.com/settings/user/security> (Account → your name →
   Security, wording varies slightly).
2. Under **Two-factor authentication**, click **Enable**, choose **Authenticator app**,
   scan and confirm.
3. Store the recovery codes in your password manager.
4. Note: Plaid requires MFA org-wide for production access anyway — doing this now
   removes a blocker from your future production-access application.

**Evidence screenshot:** the security settings page showing 2FA enabled.

## 4. Google account (OAuth client for sign-in + Play Console)

This is the personal/developer Google account that owns the Google Cloud OAuth client and
(eventually) the Play Console listing.

1. Go to <https://myaccount.google.com/security>.
2. Under "How you sign in to Google", click **2-Step Verification** → **Turn on**.
3. Google will push you toward phone-prompt sign-in; after enabling, go back into
   2-Step Verification and **add an Authenticator app** entry as well, so you're not
   dependent on one device.
4. Print/save the backup codes (option at the bottom of the 2-Step Verification page).

**Evidence screenshot:** the Security page showing "2-Step Verification: On" with the
enrolled methods.

## 5. Expo / EAS (build pipeline and OTA updates)

An attacker with this account could ship code to users' devices via OTA update, so it
counts as critical even though it holds no user data.

1. Go to <https://expo.dev/settings> → **Two-factor authentication**.
2. Click **Enable two-factor authentication**, choose authenticator app, scan and confirm.
3. Save the recovery codes.

**Evidence screenshot:** the settings section showing 2FA enabled.

## Apple ID (already enforced)

Apple Developer Program accounts require Apple ID two-factor authentication — if you have
an active developer account, this is already on. For evidence: Settings → [your name] →
Sign-In & Security on an iPhone, or <https://account.apple.com> → Sign-In and Security,
showing "Two-Factor Authentication: On".

---

## After you're done

1. Drop the evidence screenshots into this folder (`docs/security/evidence/`), named like
   `mfa-github-2026-07-XX.png`.
2. Update the risk register row in
   [risk-assessment-process.md](../risk-assessment-process.md) from **Open** to
   **Closed** with the date.
3. Update [password-mfa-policy.md](../password-mfa-policy.md)'s status table — the
   "verify enrollment at each policy review" entries become "verified 2026-07-XX".
4. Plaid questionnaire Q4's answer ("not fully confirmed as of this review") can then be
   revised to a clean **Yes** in
   [plaid-vendor-questionnaire-2026-07-05.md](../plaid-vendor-questionnaire-2026-07-05.md)
   before you submit it.
