-- Penny Pilot initial Supabase schema draft.
-- This assumes Supabase Auth is enabled and user-owned records use auth.uid().

create extension if not exists "pgcrypto";

create type public.plan_tier as enum ('free', 'plus', 'pro');
create type public.sync_provider as enum ('plaid');
create type public.sync_status as enum ('healthy', 'needs-reconnect', 'syncing', 'error');
create type public.account_kind as enum ('checking', 'savings', 'credit', 'loan', 'investment', 'cash', 'other');
create type public.transaction_kind as enum ('income', 'expense', 'transfer');
create type public.category_kind as enum ('income', 'fixed', 'variable', 'savings', 'debt', 'transfer');
create type public.category_confidence as enum ('high', 'medium', 'low', 'none');
create type public.budget_style as enum ('guided-flexible', 'fifty-thirty-twenty', 'zero-based', 'envelopes');
create type public.goal_kind as enum (
  'home',
  'car',
  'emergency-fund',
  'vacation',
  'wedding',
  'moving',
  'loan-payoff',
  'credit-card-payoff',
  'custom'
);
create type public.goal_status as enum ('active', 'paused', 'completed', 'archived');
create type public.forecast_model as enum ('simple-moving-average', 'ewma', 'random-walk-drift');
create type public.forecast_visibility as enum ('friendly', 'advanced');
create type public.entitlement_source as enum ('free', 'subscription', 'promo', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  plan_tier public.plan_tier not null default 'free',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.setup_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  budget_style public.budget_style not null default 'guided-flexible',
  selected_category_template_ids text[] not null default '{}',
  selected_goal_kinds public.goal_kind[] not null default '{}',
  guidance_tone text not null default 'balanced' check (guidance_tone in ('gentle', 'balanced', 'direct')),
  bank_sync_intent text not null default 'later' check (bank_sync_intent in ('now', 'later')),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plaid_item_id text not null,
  access_token_ciphertext text not null,
  institution_id text not null,
  institution_name text not null,
  status public.sync_status not null default 'healthy',
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_item_id)
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  provider public.sync_provider not null default 'plaid',
  provider_account_id text not null,
  name text not null,
  official_name text,
  mask text,
  kind public.account_kind not null default 'other',
  current_balance numeric(14,2),
  available_balance numeric(14,2),
  iso_currency_code text not null default 'USD',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_account_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_user_lower_name_idx on public.categories (user_id, lower(name));

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subcategories_category_lower_name_idx on public.subcategories (category_id, lower(name));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  provider_transaction_id text,
  date date not null,
  merchant_name text not null,
  normalized_merchant text not null,
  original_description text not null,
  amount numeric(14,2) not null,
  kind public.transaction_kind not null,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  category_confidence public.category_confidence not null default 'none',
  needs_review boolean not null default true,
  pending boolean not null default false,
  excluded_from_budget boolean not null default false,
  plaid_category jsonb not null default '[]',
  raw_provider_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_transaction_id)
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_user_review_idx on public.transactions (user_id, needs_review) where needs_review;
create index transactions_user_merchant_idx on public.transactions (user_id, normalized_merchant);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  normalized_merchant text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  confidence public.category_confidence not null default 'high',
  times_applied integer not null default 0,
  last_applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_merchant)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  style public.budget_style not null default 'guided-flexible',
  income_target numeric(14,2) not null default 0,
  savings_target numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  kind public.category_kind not null check (kind in ('fixed', 'variable', 'savings', 'debt')),
  name text not null,
  planned_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.goal_kind not null,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  target_date date,
  monthly_contribution_target numeric(14,2),
  linked_account_id uuid references public.bank_accounts(id) on delete set null,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('goal', 'category', 'budget')),
  subject_id uuid not null,
  model public.forecast_model not null,
  visibility public.forecast_visibility not null default 'friendly',
  projected_amount numeric(14,2) not null,
  projected_date date,
  error_score numeric(12,6),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.entitlements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  active boolean not null default false,
  source public.entitlement_source not null default 'free',
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.profiles enable row level security;
alter table public.setup_preferences enable row level security;
alter table public.plaid_items enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.transactions enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;
alter table public.goals enable row level security;
alter table public.forecast_snapshots enable row level security;
alter table public.entitlements enable row level security;

create policy "profiles are self-owned" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "setup preferences are self-owned" on public.setup_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "plaid items are self-owned" on public.plaid_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bank accounts are self-owned" on public.bank_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories are self-owned" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subcategories are self-owned" on public.subcategories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions are self-owned" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "merchant rules are self-owned" on public.merchant_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budgets are self-owned" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budget lines are self-owned" on public.budget_lines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals are self-owned" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "forecasts are self-owned" on public.forecast_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entitlements are readable by owner" on public.entitlements
  for select using (user_id = auth.uid());

-- Entitlements and Plaid access tokens should be written by trusted backend functions.
