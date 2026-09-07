-- 004 complete screens: events, horses, social feed, teams video analysis, CRHSR affiliations
--
-- Idempotent. Adds the tables the Events / Horses / Feed / Team Analysis / CRHSR
-- screens read and write. Safe to re-apply during development.

-- =====================================================================
-- 1. EVENTS ------------------------------------------------------------
-- =====================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  discipline text,
  title text not null,
  description text,
  location text,
  city text,
  state text,
  start_date timestamptz,
  end_date timestamptz,
  entries_open timestamptz,
  entries_close timestamptz,
  producer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists events_discipline_start_idx
  on public.events (discipline, start_date);

alter table public.events enable row level security;

drop policy if exists "events_read" on public.events;
create policy "events_read" on public.events
  for select using (auth.role() = 'authenticated');

drop policy if exists "events_producer_write" on public.events;
create policy "events_producer_write" on public.events
  for all using (auth.uid() = producer_id) with check (auth.uid() = producer_id);

-- =====================================================================
-- 2. HORSES / ANIMALS --------------------------------------------------
-- The horses table exists in some apps with a different (barn_name based)
-- schema. Create the simple shape where missing, and additively ensure the
-- columns the app UI needs exist everywhere.
-- =====================================================================
create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text,
  breed text,
  age integer,
  color text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table if exists public.horses
  add column if not exists name text,
  add column if not exists breed text,
  add column if not exists age integer,
  add column if not exists color text,
  add column if not exists notes text,
  add column if not exists photo_url text;

-- Where a legacy NOT NULL barn_name column exists, relax it so inserts that
-- only set the new simple columns succeed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'horses' and column_name = 'barn_name'
  ) then
    execute 'alter table public.horses alter column barn_name drop not null';
  end if;
end $$;

alter table public.horses enable row level security;
drop policy if exists "horses_owner_all" on public.horses;
create policy "horses_owner_all" on public.horses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- =====================================================================
-- 3. SOCIAL FEED -------------------------------------------------------
-- =====================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  content text,
  photo_url text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id)
);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;

drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts for select using (auth.role() = 'authenticated');
drop policy if exists "posts_author_write" on public.posts;
create policy "posts_author_write" on public.posts
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "post_likes_read" on public.post_likes;
create policy "post_likes_read" on public.post_likes for select using (auth.role() = 'authenticated');
drop policy if exists "post_likes_own" on public.post_likes;
create policy "post_likes_own" on public.post_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "post_comments_read" on public.post_comments;
create policy "post_comments_read" on public.post_comments for select using (auth.role() = 'authenticated');
drop policy if exists "post_comments_author" on public.post_comments;
create policy "post_comments_author" on public.post_comments
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows for select using (auth.role() = 'authenticated');
drop policy if exists "follows_own" on public.follows;
create policy "follows_own" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Keep denormalised counts in sync via triggers.
create or replace function public.bump_post_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists post_likes_count_trg on public.post_likes;
create trigger post_likes_count_trg
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_like_count();

create or replace function public.bump_post_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists post_comments_count_trg on public.post_comments;
create trigger post_comments_count_trg
  after insert or delete on public.post_comments
  for each row execute function public.bump_post_comment_count();

-- =====================================================================
-- 4. TEAM VIDEO ANALYSES ----------------------------------------------
-- Reuses coaching_teams + team_members from migration 003.
-- =====================================================================
create table if not exists public.team_video_analyses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.coaching_teams (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid references auth.users (id) on delete set null,
  athlete_name text,
  video_url text,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  result_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists team_video_analyses_team_idx
  on public.team_video_analyses (team_id, created_at desc);

alter table public.team_video_analyses enable row level security;

drop policy if exists "team_video_read" on public.team_video_analyses;
create policy "team_video_read" on public.team_video_analyses
  for select using (
    exists (
      select 1 from public.coaching_teams t
      where t.id = team_video_analyses.team_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.team_members m
            where m.team_id = t.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "team_video_insert" on public.team_video_analyses;
create policy "team_video_insert" on public.team_video_analyses
  for insert with check (auth.uid() = submitted_by);

-- =====================================================================
-- 5. CRHSR SCHOOL AFFILIATIONS ----------------------------------------
-- Reuses schools + school_staff from migration 003.
-- =====================================================================
create table if not exists public.school_affiliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role text not null default 'athlete' check (role in ('athlete', 'coach')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'withdrawn')),
  region text,
  season_points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);
create index if not exists school_affiliations_user_idx
  on public.school_affiliations (user_id, status);

alter table public.school_affiliations enable row level security;

drop policy if exists "school_affiliations_own" on public.school_affiliations;
create policy "school_affiliations_own" on public.school_affiliations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed a small directory of schools so registration search is usable out of
-- the box. Fixed UUIDs keep this idempotent.
insert into public.schools (id, name, level, association, region, state) values
  ('11111111-1111-1111-1111-111111111101', 'Texas A&M University', 'college', 'NIRA', 'Southern', 'TX'),
  ('11111111-1111-1111-1111-111111111102', 'Oklahoma State University', 'college', 'NIRA', 'Central Plains', 'OK'),
  ('11111111-1111-1111-1111-111111111103', 'Tarleton State University', 'college', 'NIRA', 'Southern', 'TX'),
  ('11111111-1111-1111-1111-111111111104', 'Montana State University', 'college', 'NIRA', 'Big Sky', 'MT'),
  ('11111111-1111-1111-1111-111111111105', 'Sam Houston State University', 'college', 'NIRA', 'Southern', 'TX'),
  ('11111111-1111-1111-1111-111111111106', 'Weatherford College', 'college', 'NIRA', 'Southwest', 'TX'),
  ('11111111-1111-1111-1111-111111111107', 'Casper College', 'college', 'NIRA', 'Rocky Mountain', 'WY'),
  ('11111111-1111-1111-1111-111111111108', 'Clovis Community College', 'college', 'NIRA', 'Grand Canyon', 'NM'),
  ('11111111-1111-1111-1111-111111111201', 'Stephenville High School', 'high_school', 'NHSRA', 'Texas', 'TX'),
  ('11111111-1111-1111-1111-111111111202', 'Weatherford High School', 'high_school', 'NHSRA', 'Texas', 'TX')
on conflict (id) do nothing;
