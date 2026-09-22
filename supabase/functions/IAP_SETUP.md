# IAP Backend Setup (Supabase + App Store)

## 1) Deploy migration

Apply `supabase/migrations/046_iap_subscriptions.sql`.

This creates:
- `iap_events`
- `iap_subscriptions`
- `iap_transactions`
- `sync_profile_premium_from_iap(uuid)` RPC

## 2) Set Edge Function secrets

Set these in Supabase project secrets:

- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (full `.p8` content; `\n` escaped is supported)
- `APPLE_BUNDLE_ID` (example: `com.breakawayroping.app`)
- `APPLE_ALLOWED_SUBSCRIPTION_SKUS` (comma-separated)

Example:
- `breakawayroping_premium_monthly,breakawayroping_premium_yearly`

## 3) Deploy Edge Functions

- `iap-verify-client-purchase`
- `iap-apple-webhook`

Functions are self-contained so they can be pasted/deployed in Supabase Dashboard without local shared-module imports.

## 4) Configure App Store Server Notifications V2

In App Store Connect for your app:

- Enable **App Store Server Notifications V2**
- Set the server URL to:
  - `https://<PROJECT-REF>.supabase.co/functions/v1/iap-apple-webhook`

## 5) Frontend expectations

Frontend now:
- sends `appAccountToken` with purchases (Supabase user id UUID)
- calls `iap-verify-client-purchase` after purchase and during restore/history sync
- still has local store fallback entitlement sync when backend endpoint is unavailable

## 6) Test matrix

- New purchase
- Restore purchases
- Resubscribe after cancel/expiry
- Expiry/revoke/refund via App Store test notifications
- Verify `profiles.is_premium` and `profiles.premium_expires_at` update correctly
