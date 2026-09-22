# BarrelConnect → BreakawayRoping port — status

Tracks the port of the full BarrelConnect feature set into this app. Worked in
phases; this file records what has landed and what remains so the next session
can continue without re-discovery.

## Phase 1 — Database & backend schema  ✅ DONE (this session)

**Migrations.** All 101 BarrelConnect migrations were ported into
`supabase/migrations/` with a `1NNN_` prefix so they run **after** this app's
own base migrations (`001`–`007`) and never overwrite them by filename.

- Every ported file is idempotent (`create table if not exists`,
  `drop policy if exists` → `create policy`, `create index if not exists`), so
  re-running against a database that already has this app's base tables is safe:
  existing tables are skipped, missing feature tables are created.
- **Discipline adaptation:** BarrelConnect's barrel-specific `runs` table had its
  `barrel1_time` / `barrel2_time` / `barrel3_time` split columns removed, leaving
  a generic, discipline-neutral `runs` table. This app's own discipline log
  remains `breakaway_runs` (created in `003`).
- **Validation:** all 101 ported files parse cleanly with the PostgreSQL grammar
  (`pglast`). SQL parsing ≠ live apply — they still need to be applied against the
  shared Supabase project and smoke-tested (no database was available in this
  session to apply them).

Feature domains now covered by the ported schema: marketplace (+ photos, saves,
reviews, orders, payments, analytics, price history, messages), 1:1 & group
messaging (+ read receipts, invites), haulers/transport/trips, travel planner,
arenas, sponsorship hub, live sessions (Go Live), rodeo events + registration +
payments, coaching sessions/bookings/payments + coach verification, horse health
(health records, nutrition, workout, vaccinations, vet contacts/visits/documents,
medication, recovery, care events/templates, emergency), breeding, horse views,
challenges/streaks/badges/points/leaderboards (daily + community + weekly), IAP
(subscriptions/transactions/events), onboarding, promo codes, follows,
notifications, block/report/moderation, team analysis (team_videos,
run_analysis_results, team_analysis_reports, video_comparisons).

**Edge Functions.** All discipline-agnostic BarrelConnect functions were ported
into `supabase/functions/` and rebranded (BarrelConnect → BreakawayRoping, barrel
racing → breakaway roping):

`agora-token`, `analyze-baseline`, `confirm-coaching-payment`,
`confirm-event-payment`, `confirm-marketplace-checkout`,
`create-coaching-payment`, `create-event-payment`, `daily-horse-view-digest`,
`delete-user-account`, `generate-daily-challenge`, `generate-team-report`,
`iap-apple-webhook`, `iap-verify-client-purchase`, `marketplace-checkout`,
`send-coach-verification`, `send-push-notification`, plus the shared helpers in
`_shared/` (`iap.ts`, `baselineAuth.ts`) and the `AGORA_SETUP.md` / `IAP_SETUP.md`
notes. This app's existing breakaway-adapted `analyze-video`,
`analyze-team-video`, and `revenuecat-webhook` were **left intact**.

Deno was not available in this session, so the ported functions were only
branding-adapted and copied verbatim from their working BarrelConnect source;
they still need a `deno check`/deploy pass.

## Remaining phases — NOT yet done

These are genuinely multi-session and were intentionally not rushed, because this
app is a leaner, differently-architected codebase than BarrelConnect (≈90 vs ≈457
source files; plain `StyleSheet` + a small `components/ui` set vs BarrelConnect's
uniwind/Tailwind component library, `navigation/`, `provider/`, and ~89 service
files). A wholesale screen copy would not compile here and would regress this
app's existing scoring engine, `Compete`, `Analyze`, premium reconciliation, and
rule-set integration. Each must be re-implemented against this app's architecture.

- **Phase 2 — Screens & navigation:** marketplace, messaging (1:1 + group),
  notifications, user profiles (public/edit/avatar), search/follow, stories/reels,
  Go Live, arena finder, hauling/trainer directories, sponsorship hub, event
  registration, coaching sessions, horse health dashboard, vet records, travel
  planner, challenges/leaderboards, content moderation, promo codes, delete
  account, settings. Build each with this app's `components/ui` + `constants/theme`.
- **Phase 3 — Client integrations:** Firebase/FCM push, Stripe Connect,
  Agora streaming, Google Maps. These require adding the corresponding
  dependencies (`@react-native-firebase/*`, `@stripe/stripe-react-native`,
  `react-native-agora`, `react-native-maps`, `expo-notifications`, `expo-location`,
  etc.) to `package.json` and native config in `app.config.js`, then verifying an
  EAS build — deps were deliberately **not** added yet to avoid an unbuildable
  half-wired state. (RevenueCat IAP is already wired.)
- **Phase 4 — Assets & metadata:** app icons (all sizes), splash screens,
  Firebase config files, and Privacy/Terms/Support URLs sourced from
  breakawayroping.pro.
- **Phase 5 — Testing:** apply migrations to Supabase, `deno check`/deploy the
  functions, verify screens load and queries work, and confirm builds succeed.

## Integration follow-ups (call out for the next session)

- The ported feature tables that reference the generic `runs` table
  (`ai_run_insights`, `user_streaks`, weekly leaderboards, `video_analyses.run_id`)
  will need either (a) this app's `Compete` flow to also write a row into `runs`,
  or (b) those tables/queries repointed to `breakaway_runs`, so the AI-insights,
  streaks, and leaderboard features operate on real breakaway runs.
- Some ported migrations `drop policy … / create policy …` on tables this app
  also defines (e.g. `posts`, `follows`, `notifications`); after applying, confirm
  the resulting RLS matches intended behavior for this app's column set.
