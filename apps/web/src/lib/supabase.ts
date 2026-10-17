import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@boh/shared";

export type BrowserDb = SupabaseClient<Database>;

let client: BrowserDb | null = null;

/** Read-only browser client on the publishable key. Every write goes through the server. */
export function getSupabase(): BrowserDb | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
