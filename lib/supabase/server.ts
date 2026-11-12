import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service role client. Import this file only in Route Handlers, Server Actions, or Server Components. */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Thiếu biến môi trường Supabase phía server.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
