// src/lib/supabase.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase project URL is public (not a secret) — hardcode the Rodeo Apps project.
const url = 'https://qptqfjtwonnfdaqlmrhj.supabase.co';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!anonKey) {
  // Fail loudly at startup rather than with an opaque network error on the
  // first query. A missing env var is a setup problem, not a runtime one.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env and fill it in.',
  );
}

export const supabase = createClient(url, anonKey ?? 'anon', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
