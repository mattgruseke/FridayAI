-- Run this once in the Supabase SQL editor (or `supabase db push`) on a new project.
-- It is safe to read top to bottom: tables, row-level security, then the signup trigger.

-- ─── Profiles ───────────────────────────────────────────────────────────────
-- One row per auth user. Add your own columns, then expose them in
-- src/contexts/AuthContext.tsx and whitelist editable ones in /api/profile.
create table if not exists public.user_profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  role             text not null default 'user' check (role in ('user', 'admin')),
  invite_code_used text,
  created_at       timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users read own profile" on public.user_profiles
  for select using (auth.uid() = id);
create policy "Users insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Column-level grants so users can't promote themselves to admin.
-- Make someone an admin from the SQL editor:
--   update public.user_profiles set role = 'admin' where id = '<user uuid>';
revoke insert, update on public.user_profiles from anon, authenticated;
grant insert (id) on public.user_profiles to authenticated;
grant update (full_name) on public.user_profiles to authenticated;

-- ─── Invite codes ───────────────────────────────────────────────────────────
-- RLS is on with no policies, so clients can't list codes. Signup checks a code
-- through check_invite_code() and the trigger below redeems it.
-- Create a code:
--   insert into public.invite_codes (code, uses_remaining) values ('WELCOME', 10);
create table if not exists public.invite_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code = upper(code)),
  uses_remaining integer not null default 1 check (uses_remaining >= 0),
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

create or replace function public.check_invite_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invite_codes
    where code = upper(p_code)
      and uses_remaining > 0
      and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function public.check_invite_code(text) to anon, authenticated;

-- ─── Notifications ──────────────────────────────────────────────────────────
-- Shown in the header bell. Users can read and dismiss/complete their own;
-- create them from triggers, server code with the service role, or SQL.
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null,
  message      text not null,
  action_url   text,
  is_dismissed boolean not null default false,
  dismissed_at timestamptz,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

alter table public.notifications enable row level security;

create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (is_dismissed, dismissed_at, is_completed) on public.notifications to authenticated;

-- ─── Items (sample feature) ─────────────────────────────────────────────────
-- Per-user items, split by category: each of the home, entertainment and food
-- pages shows its own category (/api/items?category=...).
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 500),
  category   text not null default 'home' check (category in ('home', 'entertainment', 'food')),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists items_user_id_category_idx on public.items (user_id, category);

alter table public.items enable row level security;

create policy "Users read own items" on public.items
  for select using (auth.uid() = user_id);
create policy "Users create own items" on public.items
  for insert with check (auth.uid() = user_id);
create policy "Users update own items" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own items" on public.items
  for delete using (auth.uid() = user_id);

-- ─── Agent intake ────────────────────────────────────────────────────────────
-- Answers to an agent's intake form (/intake), one row per user per agent.
-- `answers` holds { answers: {field: value}, known_providers: [...] }.
create table if not exists public.intake_responses (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent      text not null check (agent in ('home_manager')),
  answers    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, agent)
);

alter table public.intake_responses enable row level security;

create policy "Users read own intake" on public.intake_responses
  for select using (auth.uid() = user_id);
create policy "Users create own intake" on public.intake_responses
  for insert with check (auth.uid() = user_id);
create policy "Users update own intake" on public.intake_responses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Signup trigger ─────────────────────────────────────────────────────────
-- On every new auth user: redeem the invite code passed in signup metadata,
-- create the profile, and seed a welcome notification.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in sync with siteConfig.inviteOnly (src/config/site.ts). While true,
  -- users created without a code (including from the Supabase dashboard) are rejected.
  require_invite constant boolean := true;
  v_code text := upper(nullif(trim(new.raw_user_meta_data ->> 'invite_code'), ''));
begin
  if v_code is not null then
    update public.invite_codes
      set uses_remaining = uses_remaining - 1
      where code = v_code
        and uses_remaining > 0
        and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'Invalid or expired invite code';
    end if;
  elsif require_invite then
    raise exception 'An invite code is required to sign up';
  end if;

  insert into public.user_profiles (id, invite_code_used)
    values (new.id, v_code)
    on conflict (id) do nothing;

  insert into public.notifications (user_id, type, message, action_url)
    values (new.id, 'welcome', 'Welcome! Add your name on your profile page.', '/profile');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
