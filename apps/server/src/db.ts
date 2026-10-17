import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@boh/shared";
import { env, features } from "./env.ts";

export type Db = SupabaseClient<Database>;

let client: Db | undefined;

/** Service-role client: bypasses row level security, so it must never leave the server. */
export function db(): Db {
  if (!features.database) {
    throw new Error("Database not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the root .env");
  }
  client ??= createClient<Database>(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
