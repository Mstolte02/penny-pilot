-- Consent tracking (Plaid remediation: "a process to obtain and track consent").
-- Every affirmative consent a signed-in user gives is appended here, versioned and
-- timestamped, so consent is auditable rather than assumed. Records are immutable
-- from the client: users may INSERT and SELECT their own rows, but not UPDATE or
-- DELETE them (rewriting history would defeat the purpose of an audit trail).
-- Rows are removed only when the owning profile is deleted (ON DELETE CASCADE),
-- which is the account-deletion path.

create type public.consent_type as enum ('privacy_terms', 'plaid_data_sharing');
create type public.consent_method as enum ('in_app_gate', 'plaid_link_prompt');

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type public.consent_type not null,
  version text not null,
  method public.consent_method not null,
  -- Kept for tamper-evidence / dispute resolution; never used for tracking.
  app_version text,
  created_at timestamptz not null default now()
);

create index user_consents_user_idx on public.user_consents (user_id, consent_type, created_at desc);

alter table public.user_consents enable row level security;

-- Owner can read their own consent history...
create policy "consents are readable by owner" on public.user_consents
  for select using (user_id = auth.uid());

-- ...and can append new consent records for themselves...
create policy "consents are insertable by owner" on public.user_consents
  for insert with check (user_id = auth.uid());

-- ...but cannot modify or delete them (no UPDATE/DELETE policy = denied under RLS).
