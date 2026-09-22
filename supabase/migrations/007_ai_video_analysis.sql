-- 007 AI video analysis for breakawayroping-mobile-app
--
-- Adds the BarrelConnect-style AI video analysis schema:
--   * video_analyses      — individual-mode results (1 video -> personal critique)
--   * team_video_batches  — coach-mode results (up to 15 videos -> aggregate report)
--
-- Reuses coaching_teams + team_members from migration 003. Idempotent so it can
-- be re-applied safely during development. Storage buckets (videos, video-frames)
-- are created here too when the storage schema is available.

-- =====================================================================
-- 1. INDIVIDUAL MODE: video_analyses ----------------------------------
-- One row per athlete run. frame_urls holds the extracted keyframes that
-- were sent to OpenAI vision; analysis_result holds the full structured
-- breakaway judging payload returned by the analyze-video edge function.
-- =====================================================================
create table if not exists public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null default 'breakawayroping',
  video_url text,
  frame_urls jsonb not null default '[]'::jsonb,
  status text not null default 'completed'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  overall_score numeric,
  analysis_result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists video_analyses_user_idx
  on public.video_analyses (user_id, created_at desc);

alter table public.video_analyses enable row level security;

-- Owners can read / insert / update / delete their own analyses.
drop policy if exists "video_analyses_owner_all" on public.video_analyses;
create policy "video_analyses_owner_all" on public.video_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- 2. COACH MODE: team_video_batches -----------------------------------
-- A coach uploads a batch of runs (up to 15). Each run is stored in
-- video_analyses (or referenced by id) and the batch holds the aggregate
-- team report synthesised across all of them.
-- =====================================================================
create table if not exists public.team_video_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.coaching_teams (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null default 'breakawayroping',
  video_ids uuid[] not null default '{}',
  video_count integer not null default 0,
  status text not null default 'processing'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  aggregate_analysis jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_video_batches_team_idx
  on public.team_video_batches (team_id, created_at desc);
create index if not exists team_video_batches_coach_idx
  on public.team_video_batches (coach_id, created_at desc);

alter table public.team_video_batches enable row level security;

-- The coach who owns the batch has full control.
drop policy if exists "team_video_batches_coach_all" on public.team_video_batches;
create policy "team_video_batches_coach_all" on public.team_video_batches
  for all using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

-- The team owner (head coach) and any team member can read the batch report.
drop policy if exists "team_video_batches_read" on public.team_video_batches;
create policy "team_video_batches_read" on public.team_video_batches
  for select using (
    auth.uid() = coach_id
    or exists (
      select 1 from public.coaching_teams t
      where t.id = team_video_batches.team_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.team_members m
            where m.team_id = t.id and m.user_id = auth.uid()
          )
        )
    )
  );

-- =====================================================================
-- 3. STORAGE BUCKETS --------------------------------------------------
-- videos       — source clips uploaded from the phone
-- video-frames — extracted keyframes that OpenAI vision actually reads
-- Guarded so the migration still runs where the storage schema is absent.
-- =====================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
      values ('videos', 'videos', true)
      on conflict (id) do nothing;
    insert into storage.buckets (id, name, public)
      values ('video-frames', 'video-frames', true)
      on conflict (id) do nothing;
  end if;
end
$$;
