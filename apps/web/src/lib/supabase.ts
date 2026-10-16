/**
 * Single Supabase client for the entire app.
 * Never call createClient elsewhere (dual GoTrue = empty UI under RLS).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url =
  import.meta.env.VITE_SUPABASE_URL || 'https://frqvelcreczmnofldrga.supabase.co';

const anon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  // Public anon key already shipped in legacy frontend — same project.
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycXZlbGNyZWN6bW5vZmxkcmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzQyMDksImV4cCI6MjEwMzkxMDIwOX0.EQoGxEu8cNDF84tObZH13rwHiYt9EGcqnJiT3yRMa-w';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-frqvelcreczmnofldrga-auth-token',
      },
    });
  }
  return client;
}

export const SUPABASE_URL = url;
