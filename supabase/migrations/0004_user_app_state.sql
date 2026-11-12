-- Each user's plan, goals, categories and imports, saved to their account.
-- Until now these lived only in the phone's local storage, so a reinstall or a new
-- phone lost all of them. The app keeps one JSON snapshot per user, last write wins.
-- Bank transactions are not in here; they come from public.transactions.

create table public.user_app_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

create policy "app state is self-owned" on public.user_app_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- plan_tier decides paid features, so a user must not be able to set their own.
-- Column grants replace the table-wide ones: the app writes only these columns.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, email, display_name, onboarding_completed_at, updated_at)
  on public.profiles to authenticated;
grant update (email, display_name, onboarding_completed_at, updated_at)
  on public.profiles to authenticated;
