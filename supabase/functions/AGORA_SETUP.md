# Agora Live Token Setup

This project now includes a secure token minting function at:

- `supabase/functions/agora-token/index.ts`

## 1) Set function secrets

Run these from the project root:

```bash
supabase secrets set AGORA_APP_ID="your_agora_app_id"
supabase secrets set AGORA_APP_CERTIFICATE="your_agora_app_certificate"
supabase secrets set AGORA_TOKEN_TTL_SECONDS="3600"
```

Notes:

- `AGORA_APP_CERTIFICATE` must never be exposed in the mobile app.
- `AGORA_TOKEN_TTL_SECONDS` is optional; defaults to `3600`.

## 2) Deploy the function

```bash
supabase functions deploy agora-token
```

## 3) Remove temporary token usage from app env

In local app `.env`:

- Keep `EXPO_PUBLIC_AGORA_APP_ID`
- Clear/remove `EXPO_PUBLIC_AGORA_TEMP_TOKEN`

Then restart Expo/dev server so env vars reload.

## 4) How app now works

- Host screen requests token with role `publisher`
- Viewer screen requests token with role `subscriber`
- Function validates auth and returns `{ token, uid, expiresAt }`
- App joins Agora with the returned `token` and `uid`

## 5) Recommended production hardening

- Restrict allowed `channelName` pattern (already enforced).
- Keep short token TTL (15-60 minutes).
- Add rate limiting by `auth.uid()` and IP at the edge.
- Optionally verify host permissions from your `live_sessions` table before issuing `publisher` tokens.