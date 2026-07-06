# Employee Offboarding

**Owner:** Mark Stolte, Founder — markstolte02@gmail.com
**Last reviewed:** 2026-07-05
**Stage:** Pre-launch / active development

## Current status: not yet applicable

Penny Pilot has no employees or contractors as of this review — Mark Stolte is the only
person with access to any system listed in the
[Access Control Policy](access-control-policy.md). This policy is written now, before it's
needed, so that the checklist exists and is not improvised the first time someone leaves.

## When this applies

This policy takes effect the moment anyone other than the founder is granted access to any
of: the GitHub repository, the Supabase project, the Plaid dashboard, Apple Developer
Program / App Store Connect, Google Cloud Console / Play Console, the Expo/EAS account, or
any password-manager vault holding Penny Pilot credentials.

## Offboarding checklist (to execute on a departing person's last day, or immediately upon
involuntary termination)

- [ ] **GitHub:** remove from the organization/repository; revoke any personal access
      tokens or SSH keys they registered.
- [ ] **Supabase:** remove as a project member; if they ever had access to the
      service-role key or Edge Function secrets, rotate those secrets (service-role key,
      `PLAID_TOKEN_ENCRYPTION_KEY`, `PLAID_CLIENT_ID`/`PLAID_SECRET`) rather than relying on
      account removal alone, since a copied secret isn't revoked by removing dashboard
      access.
- [ ] **Plaid dashboard:** remove as a team member.
- [ ] **Apple Developer Program / App Store Connect:** remove from the team.
- [ ] **Google Cloud Console / Play Console:** remove IAM/team access.
- [ ] **Expo/EAS:** remove from the account/organization.
- [ ] **Password manager:** revoke vault access; rotate any credential they could have
      viewed even if not actively used (shared logins should be avoided per
      [Access Control Policy](access-control-policy.md), but any that exist must be
      rotated).
- [ ] **Physical/device access:** confirm any company-provisioned device or local copy of
      `.env`/secrets is returned or wiped.
- [ ] **Sign-off:** the founder (or, once one exists, a designated security lead) confirms
      every item above is complete and records the date, mirroring the review discipline
      in the [Access Control Policy](access-control-policy.md).

## Timing

All access listed above is revoked on the person's last working day, not on a delayed
schedule — for involuntary or for-cause departures, access is revoked before the person is
informed, to prevent retaliatory action.

## What doesn't apply yet

Background checks, exit interviews covering IP/confidentiality obligations, and a
dedicated HR offboarding process are not defined here, since they depend on decisions
(contractor vs. employee, jurisdiction) that don't exist yet for a one-person team. These
will be added when Penny Pilot's first hire is being onboarded, not left until after
someone has already left.
