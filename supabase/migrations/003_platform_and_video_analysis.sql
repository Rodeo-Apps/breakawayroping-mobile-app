-- 003 platform layer + breakaway_runs for breakawayroping-mobile-app

-- Platform layer: premium access, coaching/schools (CRHSR), and video analysis results.
-- Idempotent where practical so it can be re-applied safely during development.

-- 1. Premium + coaching columns on profiles ---------------------------------
alter table if exists public.profiles
  add column if not exists has_premium_access boolean not null default false,
  add column if not exists premium_source text,
  add column if not exists is_coach boolean not null default false,
  add column if not exists school_id uuid;

-- 2. Schools (college / high school rodeo programs) --------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('college', 'high_school')),
  association text,
  region text,
  state text,
  created_at timestamptz not null default now()
);

-- 3. School staff (coaches / administrators) --------------------------------
create table if not exists public.school_staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'coach' check (role in ('coach', 'admin', 'assistant')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

-- 4. Coaching teams ---------------------------------------------------------
create table if not exists public.coaching_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. Team members -----------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.coaching_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'athlete' check (role in ('athlete', 'coach')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- 6. Video analysis results (AI breakdowns) ---------------------------------
create table if not exists public.video_analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  video_url text,
  overall_score numeric,
  summary text,
  strengths jsonb,
  improvements jsonb,
  drills jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists video_analysis_results_user_idx
  on public.video_analysis_results (user_id, created_at desc);

-- 7. Row level security -----------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_staff enable row level security;
alter table public.coaching_teams enable row level security;
alter table public.team_members enable row level security;
alter table public.video_analysis_results enable row level security;

-- Schools are readable by any authenticated user (directory).
drop policy if exists "schools_read" on public.schools;
create policy "schools_read" on public.schools
  for select using (auth.role() = 'authenticated');

-- School staff can see their own memberships.
drop policy if exists "school_staff_self" on public.school_staff;
create policy "school_staff_self" on public.school_staff
  for select using (auth.uid() = user_id);

-- Coaching teams: owner or member can read; owner can modify.
drop policy if exists "coaching_teams_read" on public.coaching_teams;
create policy "coaching_teams_read" on public.coaching_teams
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.team_members m
      where m.team_id = coaching_teams.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "coaching_teams_write" on public.coaching_teams;
create policy "coaching_teams_write" on public.coaching_teams
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Team members: the member themselves or the team owner can read.
drop policy if exists "team_members_read" on public.team_members;
create policy "team_members_read" on public.team_members
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.coaching_teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- Video analysis results: users can read and insert their own.
drop policy if exists "video_results_select" on public.video_analysis_results;
create policy "video_results_select" on public.video_analysis_results
  for select using (auth.uid() = user_id);

drop policy if exists "video_results_insert" on public.video_analysis_results;
create policy "video_results_insert" on public.video_analysis_results
  for insert with check (auth.uid() = user_id);


-- Discipline run log for breakaway roping.
create table if not exists public.breakaway_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  time_seconds numeric,
  catch_type text,
  barrier_broken boolean not null default false,
  flag_dropped boolean not null default false,
  horse_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists breakaway_runs_user_idx on public.breakaway_runs (user_id, created_at desc);

alter table public.breakaway_runs enable row level security;

drop policy if exists "breakaway_runs_owner_all" on public.breakaway_runs;
create policy "breakaway_runs_owner_all" on public.breakaway_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
