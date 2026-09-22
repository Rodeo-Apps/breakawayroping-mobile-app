# Client Integrations

This app ships five client integrations ported from the BarrelConnect pattern:
Firebase/FCM push notifications, Stripe marketplace checkout, Agora live
streaming, Google Maps (arena finder), and image handling (avatars + listing
photos).

**Every integration degrades gracefully.** With the placeholder keys shipped in
`.env.example`, nothing crashes: each feature detects that it is unconfigured and
either hides itself or shows a friendly "not configured / coming soon" message.
Fill in the real keys below to activate each feature.

---

## 1. Client env keys (`.env`)

Copy `.env.example` to `.env` and replace the placeholders. Keys prefixed with
`EXPO_PUBLIC_` are bundled into the client build.

| Key | Feature | Behavior with placeholder |
| --- | --- | --- |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe checkout | Buy button hidden / "coming soon" shown until a real `pk_...` key is set |
| `EXPO_PUBLIC_AGORA_APP_ID` | Live streaming | GoLive shows "streaming not configured"; broadcast is skipped unless a 32-char App ID is set |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Arena map | Map still renders; supply a key for production map tiles/quota |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Backend + storage | Required for all data, uploads, and edge-function calls |

Detection logic lives in:
- `src/services/stripe/marketplaceFees.ts` → `isStripeConfigured()` (`pk_` prefix)
- `src/utils/agoraHelper.ts` → `isAgoraConfigured()` (32-char App ID)

---

## 2. Supabase edge-function secrets (server-side)

These are NOT client keys — set them with `supabase secrets set` (or in the
dashboard). The relevant edge functions already exist in `supabase/functions/`.

| Secret | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | `marketplace-checkout`, `confirm-marketplace-checkout`, event/coaching payment functions |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | `agora-token` (mints RTC tokens) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` | `send-push-notification` (FCM v1 send) |

---

## 3. Firebase / FCM setup (native)

Push notifications require native Firebase config files and a config-plugin.
This is the only integration needing extra native wiring before a device build.

1. Create a Firebase project and register the iOS bundle id `pro.breakawayroping.app`
   and the Android package `pro.breakawayroping.app`.
2. Download and add to the repo root:
   - `google-services.json` (Android)
   - `GoogleService-Info.plist` (iOS)
3. In `app.config.js`:
   - add plugins: `@react-native-firebase/app` and `@react-native-firebase/messaging`
   - add `expo-build-properties` with `ios.useFrameworks: "static"` (required by RNFirebase)
   - set `ios.googleServicesFile` and `android.googleServicesFile` to the files above
   - add the iOS `aps-environment` entitlement (`development` / `production`)
4. Enable Cloud Messaging (and APNs auth key for iOS) in the Firebase console.

Until these files exist, `src/utils/pushNotifications.ts` and
`src/hooks/useFCMMessaging.ts` lazy-import `@react-native-firebase/messaging`
inside try/catch and no-op — the app runs normally without push.

---

## 4. Google Maps native key (arena finder)

Add the Google Maps API key to `app.config.js` for native map rendering:
- iOS: `ios.config.googleMapsApiKey`
- Android: `android.config.googleMaps.apiKey`

`react-native-maps` uses `PROVIDER_GOOGLE`. Arenas without latitude/longitude are
skipped; when no arena has coordinates, the map view shows an overlay message.

---

## 5. Agora live streaming (native)

Camera and microphone usage descriptions are already declared in `app.config.js`
(`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, and the Android
CAMERA/RECORD_AUDIO permissions come from `react-native-agora`). No extra config
files are needed — only the `EXPO_PUBLIC_AGORA_APP_ID` client key plus the
server-side `agora-token` secrets above. Channels are namespaced `breakaway_<id>`.

---

## 6. Image handling (avatars + listing photos)

Uses `expo-image-picker` and Supabase Storage. Buckets `avatars` and
`listing-photos` and the `listing_photos` table already exist via migrations, so
no additional setup is required. Uploads are wrapped in try/catch and surface a
friendly alert on failure. See `src/utils/imageUpload.ts`.

---

## Native build note

The native libraries (`@react-native-firebase/*`, `@stripe/stripe-react-native`,
`react-native-agora`, `react-native-maps`) require a custom dev/production build
(`expo run:ios` / `expo run:android` or EAS Build) — they do not run in Expo Go.
JavaScript-only development still works; native modules stay dormant and the
graceful-degradation paths keep the app fully usable.
