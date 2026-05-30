-- ApexFunded — Supabase schema
-- Idempotent: safe to run more than once (re-running won't throw "already exists").
-- Run this in Supabase → SQL Editor (https://app.supabase.com -> your project -> SQL).
-- Auth users come from Supabase's built-in `auth.users` table.

-- ──────────────────────────────────────────────────────────────────────
-- Profiles: 1-1 with auth.users
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  country     text,
  phone       text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: owner can read" on public.profiles;
create policy "profiles: owner can read"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────
-- Challenges: a purchase made by a user (one row per Stripe checkout)
-- ──────────────────────────────────────────────────────────────────────
do $$ begin
  create type challenge_step as enum ('one','two','three');
exception when duplicate_object then null; end $$;

do $$ begin
  create type challenge_state as enum ('pending','active','passed','failed','funded','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.challenges (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  step                  challenge_step  not null,
  account_size_usd      integer         not null,           -- 2500, 5000, 10000, ...
  price_usd             integer         not null,           -- in whole dollars
  state                 challenge_state not null default 'pending',
  stripe_session_id     text unique,
  stripe_payment_intent text,
  paid_at               timestamptz,
  created_at            timestamptz default now()
);

create index if not exists challenges_user_idx on public.challenges (user_id);
create index if not exists challenges_state_idx on public.challenges (state);

alter table public.challenges enable row level security;
drop policy if exists "challenges: owner reads" on public.challenges;
create policy "challenges: owner reads"
  on public.challenges for select using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- Accounts: provisioned MT5 (or mock) account for a paid challenge
-- ──────────────────────────────────────────────────────────────────────
do $$ begin
  create type account_phase as enum ('evaluation','funded','breached','closed');
exception when duplicate_object then null; end $$;

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  challenge_id    uuid not null references public.challenges (id) on delete cascade,
  provider        text not null default 'mock',            -- 'mock' | 'metaapi'
  provider_id     text,                                    -- metaapi accountId or mock id
  mt5_login       text,                                    -- the trader's MT5 login number
  mt5_password    text,                                    -- generated password (store hashed in prod!)
  mt5_server      text,
  balance_usd     numeric(14,2) not null,
  equity_usd      numeric(14,2) not null,
  high_water_usd  numeric(14,2) not null,
  daily_loss_pct  numeric(5,2)  not null default 5,
  overall_loss_pct numeric(5,2) not null default 10,
  profit_target_pct numeric(5,2) not null default 8,
  phase           account_phase not null default 'evaluation',
  step_index      smallint not null default 1,             -- which step of N (e.g. 1 of 3)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists accounts_user_idx on public.accounts (user_id);

alter table public.accounts enable row level security;
drop policy if exists "accounts: owner reads" on public.accounts;
create policy "accounts: owner reads"
  on public.accounts for select using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- Trades: synced from MT5 periodically
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts (id) on delete cascade,
  ticket        text not null,
  symbol        text not null,
  side          text not null check (side in ('buy','sell')),
  volume        numeric(10,2) not null,
  open_price    numeric(14,5),
  close_price   numeric(14,5),
  profit_usd    numeric(14,2),
  opened_at     timestamptz,
  closed_at     timestamptz,
  unique (account_id, ticket)
);

create index if not exists trades_account_idx on public.trades (account_id);

alter table public.trades enable row level security;
drop policy if exists "trades: owner reads" on public.trades;
create policy "trades: owner reads"
  on public.trades for select using (
    exists (
      select 1 from public.accounts a
      where a.id = trades.account_id and a.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────────
-- Payouts: withdrawal requests
-- ──────────────────────────────────────────────────────────────────────
do $$ begin
  create type payout_status as enum ('requested','approved','paid','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  account_id   uuid not null references public.accounts (id) on delete cascade,
  amount_usd   numeric(14,2) not null,
  method       text not null,                              -- 'bank' | 'usdt-trc20' | 'wise'
  destination  text not null,                              -- masked account / wallet
  status       payout_status not null default 'requested',
  requested_at timestamptz default now(),
  paid_at      timestamptz
);

alter table public.payouts enable row level security;
drop policy if exists "payouts: owner reads" on public.payouts;
create policy "payouts: owner reads"
  on public.payouts for select using (auth.uid() = user_id);
drop policy if exists "payouts: owner inserts" on public.payouts;
create policy "payouts: owner inserts"
  on public.payouts for insert with check (auth.uid() = user_id);
