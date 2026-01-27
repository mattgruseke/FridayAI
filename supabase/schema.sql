-- Supabase schema for JobFinder (app router + API)

-- Extensions
create extension if not exists "pgcrypto";

-- Leads (global + user-created)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text,
  team text,
  compensation jsonb,
  contact_name text,
  contact_email text,
  additional_emails text[],
  additional_links jsonb,
  contact_linkedin text,
  source_link text,
  source_application_link text,
  date_posted date,
  industry text,
  created_by text default 'system',
  is_global boolean default false,
  shared_by text,
  shared_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists leads_created_by_idx on public.leads (created_by);
create index if not exists leads_is_global_idx on public.leads (is_global);

-- User-specific lead tracking
create table if not exists public.user_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads (id) on delete cascade,
  current_status text default 'saved',
  status_history jsonb default '[]'::jsonb,
  priority text default 'medium',
  notes text,
  custom_fields jsonb,
  saved_at timestamptz default now(),
  applied_at timestamptz,
  interviewing_at timestamptz,
  offer_at timestamptz,
  offer_accepted_at timestamptz,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, lead_id)
);

create index if not exists user_leads_user_idx on public.user_leads (user_id);
create index if not exists user_leads_status_idx on public.user_leads (user_id, current_status);
create index if not exists user_leads_priority_idx on public.user_leads (user_id, priority);

-- Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  company text,
  email text,
  linkedin text,
  notes text,
  linked_leads uuid[] default '{}'::uuid[],
  activity_history jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists referrals_user_idx on public.referrals (user_id);

-- Invite codes
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  uses_remaining integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invite_codes_code_idx on public.invite_codes (code);
