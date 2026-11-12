import { createClient } from "@supabase/supabase-js";

/** Browser client: only public URL and anon key are exposed here. */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu biến môi trường Supabase công khai.");
  return createClient(url, anonKey);
}
