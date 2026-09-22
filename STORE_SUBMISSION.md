# Store Submission — Breakaway Roping

Store-readiness metadata for App Store Connect (iOS) and Google Play Console (Android).

## App identity
| Field | Value |
|---|---|
| App name | Breakaway Roping |
| Subtitle / short | AI run analysis & practice log for breakaway ropers |
| Version | 1.0.0 |
| iOS build number | 1 |
| Android versionCode | 1 |
| iOS bundle ID | `pro.breakawayroping.app` |
| Android package | `pro.breakawayroping.app` |
| EAS projectId | `d8e86a99-baa5-475a-a3aa-ae3b66a128a2` |
| Category (primary) | Sports |
| Category (secondary) | Health & Fitness |

## Legal & support URLs (from breakawayroping.pro)
| Purpose | URL |
|---|---|
| Privacy Policy | https://www.breakawayroping.pro/privacy |
| Terms of Service | https://www.breakawayroping.pro/terms |
| Support / Contact | https://www.breakawayroping.pro/support |
| Refund Policy | https://www.breakawayroping.pro/refund |
| Support email | support@breakawayroping.pro |
| Marketing site | https://www.breakawayroping.pro |

## Age rating
- **Apple:** 4+ (no objectionable content). No violence, gambling, or mature themes.
- **Google Play (IARC):** Everyone. Content: sports/user-generated video. Note user-generated content (video uploads, social feed, messaging) in the Play questionnaire.
- The app contains in-app purchases (premium subscription) and user-generated content; declare both.

## Description

### Short (Google Play, ≤80 chars)
AI breakaway-roping run analysis, scoring, and a practice log for you and your team.

### Promotional text (Apple, ≤170 chars)
Film your run from the stands and get an instant AI breakdown — barrier work, horse rate, loop delivery, catch, and timing — plus a full practice log.

### Full description
Breakaway Roping is the all-in-one training companion for breakaway ropers of every level.

AI VIDEO ANALYSIS
Film a run from the stands and get an instant, judge-style breakdown scored on the criteria that decide runs: barrier work, horse positioning and rate, loop delivery, catch zone (neck-only legal catch), rope and slack management, string release off the horn, and overall timing. Every run comes back with strengths, specific fixes, and practice-pen drills.

COACH MODE
Coaches can analyze up to 15 runs at once and get an aggregate team report that tallies the faults shared across the squad — so you know exactly what to drill next practice.

PRACTICE LOG & SCORING
Log every run with official-time scoring that applies real association rules (WPRA/PRCA), track personal bests, streaks, and progress over time.

MORE
Marketplace for horses, tack and trailers; arena and hauler directories; a community feed; live streaming; and horse-health tracking.

Premium unlocks unlimited AI analysis and coach features. Subscriptions are billed through your app store account.

### Keywords (Apple, ≤100 chars)
breakaway roping,rodeo,roping,horse,barrel,coach,run timer,practice,WPRA,rope

## Screenshots (to capture before submit)
Required sizes — iPhone 6.7" (1290×2796) and 6.5"; iPad 12.9"; Android phone + 7"/10" tablet.
Suggested shots: (1) AI analysis result, (2) coach team report, (3) practice log / stats,
(4) marketplace, (5) community feed.

## In-app purchases / subscriptions
- Premium subscription via RevenueCat (Apple StoreKit / Google Play Billing).
- Configure products in App Store Connect and Play Console; IDs consumed by `src/services/iapService.ts`.
- Server webhook: `supabase/functions/revenuecat-webhook` (set `REVENUECAT_WEBHOOK_AUTH`).

## Data safety / privacy disclosures
Collected: account (email), user content (run videos, frames, posts, messages), usage.
Video frames are uploaded to Supabase storage and sent to OpenAI for analysis — disclose third-party
processing (OpenAI) in the privacy questionnaire. Full policy: the Privacy URL above.

## Required env / secrets for a release build
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (edge),
`OPENAI_API_KEY` (edge), `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`, `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`.

---

## Submission checklist
- [x] Version set to 1.0.0 (iOS buildNumber 1, Android versionCode 1)
- [x] Bundle ID / package = `pro.breakawayroping.app` (iOS + Android match)
- [x] App icon (1024×1024) at `assets/icon.png`
- [x] Android adaptive icon foreground at `assets/adaptive-icon.png` + background color
- [x] Splash screen at `assets/splash.png`
- [x] Web favicon at `assets/favicon.png`
- [x] Privacy, Terms, Support, Refund URLs wired into `app.config.js` → `extra`
- [x] `ITSAppUsesNonExemptEncryption: false` set (avoids export-compliance prompt)
- [x] Camera / microphone / photo-library usage descriptions present
- [x] EAS projectId present
- [ ] Capture and upload store screenshots (all required sizes)
- [ ] Configure IAP products in App Store Connect + Play Console
- [ ] Complete Apple age rating (4+) and Play IARC questionnaire (Everyone)
- [ ] Complete App Privacy / Data safety questionnaires (declare OpenAI processing + UGC)
- [ ] `eas build --platform all` then `eas submit`
