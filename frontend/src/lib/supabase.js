/**
 * Supabase client — configured-aware, never a garbage placeholder.
 * ================================================================
 * The app is fully functional WITHOUT Supabase (localStorage adapters
 * everywhere); when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are present the
 * team layers light up: shared tenant packages, cross-device projects, auth.
 * Callers must check `supabaseConfigured` (or handle the null client) — no
 * code path may throw because the env is absent.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = /^https:\/\//.test(url) && anonKey.length > 20;

let _client = null;
/** @returns the shared client, or null when the env isn't configured. */
export function getSupabase() {
  if (!supabaseConfigured) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}

// Back-compat named export (existing imports); null when unconfigured.
export const supabase = getSupabase();
