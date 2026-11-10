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

-- Priority order, status, notes, schedule and completion time. Safe to re-run on an existing project:
-- current items keep their newest-first order, and items already done have no
-- completed_at because the real time wasn't recorded.
alter table public.items add column if not exists completed_at timestamptz;
alter table public.items add column if not exists sort_order bigint;
alter table public.items add column if not exists notes text
  check (char_length(notes) <= 5000);
-- When it's booked for. A date puts the item on the calendar (/calendar).
alter table public.items add column if not exists scheduled_on date;
alter table public.items add column if not exists scheduled_time time;
-- When it has to be done by. Separate from scheduled_on, which is when it's booked.
alter table public.items add column if not exists due_on date;
-- How much it matters (ITEM_FLAGS in src/api/client.ts). With due_on it decides the
-- Eisenhower box, so box is only kept for old rows. Boxes picked before flags become
-- flags here; safe to re-run, since it only fills flags that are still empty.
alter table public.items add column if not exists flag text check (flag in ('must', 'nice', 'someday'));
update public.items set flag = case box
    when 'urgent_important' then 'must'
    when 'important' then 'nice'
    else 'someday'
  end
  where flag is null and box is not null;
-- Where an open item stands. "Done" is the done column, so reopening an item
-- returns it to the status it had. Keep in sync with ITEM_STATUSES (src/api/client.ts).
alter table public.items add column if not exists status text not null default 'not_started'
  check (status in ('needs_research', 'not_started', 'in_progress', 'scheduled'));

-- "none" is for tasks sorted from the Brain Dump before they get an area. Keep in sync
-- with ITEM_CATEGORIES (src/api/client.ts).
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check
  check (category in ('home', 'entertainment', 'food', 'none'));

-- Which Eisenhower box it's in. Null means it hasn't been sorted yet. Keep in sync with
-- ITEM_BOXES (src/api/client.ts).
alter table public.items add column if not exists box text
  check (box in ('urgent_important', 'important', 'urgent', 'backlog'));

create sequence if not exists public.items_sort_order_seq;
grant usage, select on sequence public.items_sort_order_seq to authenticated;

update public.items i
  set sort_order = o.next_order
  from (
    select id, nextval('public.items_sort_order_seq') as next_order
    from (select id from public.items where sort_order is null order by created_at desc) s
  ) o
  where i.id = o.id;

-- New items take the next value, which puts them at the bottom of the list.
alter table public.items
  alter column sort_order set default nextval('public.items_sort_order_seq'),
  alter column sort_order set not null;

-- Applies a new order to the given items by shuffling the sort_order values they
-- already hold, so items outside the list (other categories) keep their places.
create or replace function public.reorder_items(p_ids uuid[])
returns void
language sql
set search_path = public
as $$
  with ordered as (
    select i.id, row_number() over (order by t.ord) as rn
    from unnest(p_ids) with ordinality as t (id, ord)
    join public.items i on i.id = t.id and i.user_id = auth.uid()
  ),
  slots as (
    select i.sort_order, row_number() over (order by i.sort_order) as rn
    from public.items i
    join ordered o on o.id = i.id
  )
  update public.items i
    set sort_order = s.sort_order
    from ordered o
    join slots s on s.rn = o.rn
    where i.id = o.id;
$$;

grant execute on function public.reorder_items(uuid[]) to authenticated;

alter table public.items enable row level security;

create policy "Users read own items" on public.items
  for select using (auth.uid() = user_id);
create policy "Users create own items" on public.items
  for insert with check (auth.uid() = user_id);
create policy "Users update own items" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own items" on public.items
  for delete using (auth.uid() = user_id);

-- ─── Restaurants ─────────────────────────────────────────────────────────────
-- Places the user has logged (/restaurants). cuisine / occasions / services drive
-- the page's filters; keep their values in sync with src/config/restaurants.ts.
create table if not exists public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 200),
  cuisine       text not null default 'other' check (cuisine in (
                  'breakfast', 'italian', 'mexican', 'chinese', 'poke', 'sushi', 'indian',
                  'ramen', 'greek', 'bakeries', 'thai', 'salads', 'bbq', 'other')),
  style         text,  -- shown instead of the cuisine label, e.g. "Steakhouse"
  location      text,
  distance      text,  -- e.g. "5 min drive"
  price         smallint check (price between 1 and 4),
  occasions     text[] not null default '{}'
                  check (occasions <@ array['datenight', 'casual']::text[]),
  services      text[] not null default '{}'
                  check (services <@ array['dinein', 'delivery', 'takeout']::text[]),
  tags          text[] not null default '{}',
  note          text,
  usual_order   text,
  booking_label text,  -- e.g. "Book via OpenTable", "Walk-in only"
  booking_url   text check (booking_url ~* '^https?://'),
  created_at    timestamptz not null default now()
);

create index if not exists restaurants_user_id_idx on public.restaurants (user_id);

alter table public.restaurants enable row level security;

create policy "Users read own restaurants" on public.restaurants
  for select using (auth.uid() = user_id);
create policy "Users create own restaurants" on public.restaurants
  for insert with check (auth.uid() = user_id);
create policy "Users update own restaurants" on public.restaurants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own restaurants" on public.restaurants
  for delete using (auth.uid() = user_id);

-- One row per visit / check-in. A restaurant's rating is the average of these.
create table if not exists public.restaurant_visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  visited_on    date not null default current_date,
  rating        smallint check (rating between 1 and 10),
  rated_by      text,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists restaurant_visits_restaurant_id_idx
  on public.restaurant_visits (restaurant_id);

alter table public.restaurant_visits enable row level security;

create policy "Users read own visits" on public.restaurant_visits
  for select using (auth.uid() = user_id);
create policy "Users create own visits" on public.restaurant_visits
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.user_id = auth.uid())
  );
create policy "Users delete own visits" on public.restaurant_visits
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

-- Uploaded home inspection reports (/api/intake/report). Private bucket; each
-- user can only touch files under a folder named with their user id.
insert into storage.buckets (id, name, public)
  values ('inspection-reports', 'inspection-reports', false)
  on conflict (id) do nothing;

create policy "Users read own inspection reports" on storage.objects
  for select using (bucket_id = 'inspection-reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own inspection reports" on storage.objects
  for insert with check (bucket_id = 'inspection-reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own inspection reports" on storage.objects
  for delete using (bucket_id = 'inspection-reports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Home records ───────────────────────────────────────────────────────────
-- Capital improvements (/improvements), plus the maintenance schedule and service
-- history (/maintenance). Keep type values and interval_months in sync with
-- src/config/homeRecords.ts. receipts holds [{ name, path }] files in the
-- home-records bucket.
create table if not exists public.home_improvements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  type           text not null default 'improvement' check (type in ('improvement', 'appliance', 'repair')),
  completed_on   date,
  cost           numeric(12, 2) check (cost >= 0),
  done_by        text,
  warranty_until date,
  notes          text check (char_length(notes) <= 5000),
  receipts       jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists home_improvements_user_id_idx on public.home_improvements (user_id);

alter table public.home_improvements enable row level security;

create policy "Users read own improvements" on public.home_improvements
  for select using (auth.uid() = user_id);
create policy "Users create own improvements" on public.home_improvements
  for insert with check (auth.uid() = user_id);
create policy "Users update own improvements" on public.home_improvements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own improvements" on public.home_improvements
  for delete using (auth.uid() = user_id);

create table if not exists public.maintenance_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  interval_months smallint check (interval_months > 0),  -- null means as needed
  notes           text check (char_length(notes) <= 5000),
  created_at      timestamptz not null default now()
);

create index if not exists maintenance_items_user_id_idx on public.maintenance_items (user_id);

alter table public.maintenance_items enable row level security;

create policy "Users read own maintenance items" on public.maintenance_items
  for select using (auth.uid() = user_id);
create policy "Users create own maintenance items" on public.maintenance_items
  for insert with check (auth.uid() = user_id);
create policy "Users update own maintenance items" on public.maintenance_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own maintenance items" on public.maintenance_items
  for delete using (auth.uid() = user_id);

create table if not exists public.maintenance_services (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    uuid not null references public.maintenance_items (id) on delete cascade,
  service_on date not null default current_date,
  provider   text,
  cost       numeric(12, 2) check (cost >= 0),
  notes      text check (char_length(notes) <= 5000),
  receipts   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_services_user_id_idx on public.maintenance_services (user_id);
create index if not exists maintenance_services_item_id_idx on public.maintenance_services (item_id);

alter table public.maintenance_services enable row level security;

create policy "Users read own services" on public.maintenance_services
  for select using (auth.uid() = user_id);
create policy "Users create own services" on public.maintenance_services
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.maintenance_items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "Users update own services" on public.maintenance_services
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (select 1 from public.maintenance_items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "Users delete own services" on public.maintenance_services
  for delete using (auth.uid() = user_id);

-- Who you call for the house (/providers). category is a label from
-- PROVIDER_CATEGORIES (src/config/homeManagerIntake.ts). Tasks can be assigned to one.
create table if not exists public.service_providers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  category   text not null check (char_length(category) between 1 and 100),
  company    text check (char_length(company) <= 200),
  phone      text check (char_length(phone) <= 50),
  email      text check (char_length(email) <= 200),
  website    text check (char_length(website) <= 500),
  notes      text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists service_providers_user_id_idx on public.service_providers (user_id);

alter table public.service_providers enable row level security;

create policy "Users read own service providers" on public.service_providers
  for select using (auth.uid() = user_id);
create policy "Users create own service providers" on public.service_providers
  for insert with check (auth.uid() = user_id);
create policy "Users update own service providers" on public.service_providers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own service providers" on public.service_providers
  for delete using (auth.uid() = user_id);

-- Deleting a provider leaves their tasks in place, unassigned.
alter table public.items add column if not exists provider_id uuid
  references public.service_providers (id) on delete set null;

-- Private bucket; each user can only touch files under a folder named with their user id.
insert into storage.buckets (id, name, public)
  values ('home-records', 'home-records', false)
  on conflict (id) do nothing;

create policy "Users read own home records" on storage.objects
  for select using (bucket_id = 'home-records' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own home records" on storage.objects
  for insert with check (bucket_id = 'home-records' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own home records" on storage.objects
  for delete using (bucket_id = 'home-records' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Family calendar ────────────────────────────────────────────────────────
-- Events and the childcare schedule (/calendar). A schedule is a normal week that
-- applies from effective_from until a later one takes over, so past weeks keep their
-- real numbers. An override replaces one day. Their blocks hold
-- [{ person_id, start, end }] (schedules add weekday, 0 = Sunday).
create table if not exists public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  event_on   date not null,
  start_time time,  -- null means all day
  location   text,
  notes      text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_id_idx on public.calendar_events (user_id, event_on);

alter table public.calendar_events enable row level security;

create policy "Users read own events" on public.calendar_events
  for select using (auth.uid() = user_id);
create policy "Users create own events" on public.calendar_events
  for insert with check (auth.uid() = user_id);
create policy "Users update own events" on public.calendar_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own events" on public.calendar_events
  for delete using (auth.uid() = user_id);

create table if not exists public.childcare_people (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  color      text not null,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists childcare_people_user_id_idx on public.childcare_people (user_id);

alter table public.childcare_people enable row level security;

create policy "Users read own childcare people" on public.childcare_people
  for select using (auth.uid() = user_id);
create policy "Users create own childcare people" on public.childcare_people
  for insert with check (auth.uid() = user_id);
create policy "Users update own childcare people" on public.childcare_people
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.childcare_schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null,
  coverage_start time not null default '07:00',
  coverage_end   time not null default '18:00',
  coverage_days  smallint[] not null default '{1,2,3,4,5}',
  blocks         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);

alter table public.childcare_schedules enable row level security;

create policy "Users read own childcare schedules" on public.childcare_schedules
  for select using (auth.uid() = user_id);
create policy "Users create own childcare schedules" on public.childcare_schedules
  for insert with check (auth.uid() = user_id);
create policy "Users update own childcare schedules" on public.childcare_schedules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own childcare schedules" on public.childcare_schedules
  for delete using (auth.uid() = user_id);

create table if not exists public.childcare_overrides (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  on_date    date not null,
  blocks     jsonb not null default '[]'::jsonb,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, on_date)
);

alter table public.childcare_overrides enable row level security;

create policy "Users read own childcare overrides" on public.childcare_overrides
  for select using (auth.uid() = user_id);
create policy "Users create own childcare overrides" on public.childcare_overrides
  for insert with check (auth.uid() = user_id);
create policy "Users update own childcare overrides" on public.childcare_overrides
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own childcare overrides" on public.childcare_overrides
  for delete using (auth.uid() = user_id);

-- Weekly plan (/calendar, Weekly plan tab). One row per planned day, filled in by
-- hand each week. work holds { parent_id: { location_id, commute, leave_at, start, end, home_at } }
-- and dinner holds { plan, meal, meal_id, owner, home: { parent_id: boolean } }. Settings hold the
-- household's two parents, its work locations, and each parent's standard days to fill in from.
-- dishes holds [{ id, meal_id, name, occasion }]: sides and desserts being made that day.
create table if not exists public.planner_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_on    date not null,
  work       jsonb not null default '{}'::jsonb,
  dinner     jsonb not null default '{}'::jsonb,
  dishes     jsonb not null default '[]'::jsonb,
  note       text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  unique (user_id, plan_on)
);

alter table public.planner_days enable row level security;

create policy "Users read own plan days" on public.planner_days
  for select using (auth.uid() = user_id);
create policy "Users create own plan days" on public.planner_days
  for insert with check (auth.uid() = user_id);
create policy "Users update own plan days" on public.planner_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own plan days" on public.planner_days
  for delete using (auth.uid() = user_id);

create table if not exists public.planner_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  parents    jsonb not null default '[]'::jsonb,
  locations  jsonb not null default '[]'::jsonb,
  standard_days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.planner_settings enable row level security;

create policy "Users read own planner settings" on public.planner_settings
  for select using (auth.uid() = user_id);
create policy "Users create own planner settings" on public.planner_settings
  for insert with check (auth.uid() = user_id);
create policy "Users update own planner settings" on public.planner_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meals (/food) and each week's grocery list. A meal's ingredients hold
-- [{ name, quantity, group }]. A grocery list is worked out from the week's planned
-- dinners, so grocery_weeks only keeps what's been changed or ordered.
create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  kind         text not null default 'meal',  -- meal, side or dessert
  cuisine      text not null,
  methods      jsonb not null default '[]'::jsonb,
  prep_minutes integer check (prep_minutes between 0 and 2880),
  cook_minutes integer check (cook_minutes between 0 and 2880),
  servings     integer check (servings between 1 and 100),
  ingredients  jsonb not null default '[]'::jsonb,
  tags         jsonb not null default '[]'::jsonb,
  notes        text check (char_length(notes) <= 10000),
  recipe_url   text check (char_length(recipe_url) <= 2000),
  created_at   timestamptz not null default now()
);

create index if not exists meals_user_id_idx on public.meals (user_id);

alter table public.meals enable row level security;

create policy "Users read own meals" on public.meals
  for select using (auth.uid() = user_id);
create policy "Users create own meals" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "Users update own meals" on public.meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own meals" on public.meals
  for delete using (auth.uid() = user_id);

create table if not exists public.grocery_weeks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_of      date not null,
  have         jsonb not null default '[]'::jsonb,
  need         jsonb not null default '[]'::jsonb,
  extras       jsonb not null default '[]'::jsonb,
  ordered_at   timestamptz,
  ordered_keys jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, week_of)
);

alter table public.grocery_weeks enable row level security;

create policy "Users read own grocery weeks" on public.grocery_weeks
  for select using (auth.uid() = user_id);
create policy "Users create own grocery weeks" on public.grocery_weeks
  for insert with check (auth.uid() = user_id);
create policy "Users update own grocery weeks" on public.grocery_weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Brain Dump (/brain-dump): everything goes in here first, then gets sorted into a task
-- or an entry. Entries are goals, ideas and notes in one table, so moving one between
-- lists only changes kind. Links join any two of task, entry or Brain Dump item, both ways.
create table if not exists public.brain_dump (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 5000),
  state      text not null default 'open' check (state in ('open', 'sorted', 'archived')),
  sorted_as  text check (sorted_as in ('task', 'goal', 'idea', 'note', 'watch')),
  sorted_id  text,
  sorted_at  timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brain_dump_user_id_idx on public.brain_dump (user_id, state);

alter table public.brain_dump enable row level security;

create policy "Users read own brain dump" on public.brain_dump
  for select using (auth.uid() = user_id);
create policy "Users create own brain dump" on public.brain_dump
  for insert with check (auth.uid() = user_id);
create policy "Users update own brain dump" on public.brain_dump
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own brain dump" on public.brain_dump
  for delete using (auth.uid() = user_id);

create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('goal', 'idea', 'note')),
  title      text not null check (char_length(title) between 1 and 500),
  details    text check (char_length(details) <= 10000),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_id_idx on public.entries (user_id, kind);

alter table public.entries enable row level security;

create policy "Users read own entries" on public.entries
  for select using (auth.uid() = user_id);
create policy "Users create own entries" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "Users update own entries" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own entries" on public.entries
  for delete using (auth.uid() = user_id);

create table if not exists public.links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  a_type     text not null check (a_type in ('task', 'entry', 'dump')),
  a_id       text not null,
  b_type     text not null check (b_type in ('task', 'entry', 'dump')),
  b_id       text not null,
  created_at timestamptz not null default now()
);

create index if not exists links_user_id_idx on public.links (user_id);

alter table public.links enable row level security;

create policy "Users read own links" on public.links
  for select using (auth.uid() = user_id);
create policy "Users create own links" on public.links
  for insert with check (auth.uid() = user_id);
create policy "Users update own links" on public.links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own links" on public.links
  for delete using (auth.uid() = user_id);

-- "watch" (sorted onto the Entertainment list) came later; safe to re-run.
alter table public.brain_dump drop constraint if exists brain_dump_sorted_as_check;
alter table public.brain_dump add constraint brain_dump_sorted_as_check
  check (sorted_as in ('task', 'goal', 'idea', 'note', 'watch'));

-- ─── Entertainment ─────────────────────────────────────────────────────────
-- Things to watch, read or listen to (/entertainment). Its own list, never a task.
-- Options for media_kind, platform and vibes are in src/config/entertainment.ts;
-- a null platform means unknown.
create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 500),
  media_kind text check (media_kind in ('movie', 'tv', 'book', 'podcast')),
  platform   text check (char_length(platform) <= 100),
  vibes      text[] not null default '{}',
  image_url  text check (char_length(image_url) <= 500),
  notes      text check (char_length(notes) <= 5000),
  done       boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);

alter table public.watchlist enable row level security;

create policy "Users read own watchlist" on public.watchlist
  for select using (auth.uid() = user_id);
create policy "Users create own watchlist" on public.watchlist
  for insert with check (auth.uid() = user_id);
create policy "Users update own watchlist" on public.watchlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own watchlist" on public.watchlist
  for delete using (auth.uid() = user_id);

-- Entertainment used to be tasks in an "entertainment" area. Move any across and take
-- them out of Tasks. (The app does the same the first time either list loads.)
insert into public.watchlist (user_id, title, notes, done, done_at, created_at)
  select user_id, title, notes, done, completed_at, created_at
  from public.items where category = 'entertainment';
delete from public.items where category = 'entertainment';

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
