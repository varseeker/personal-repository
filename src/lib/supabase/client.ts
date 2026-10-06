import { createBrowserClient } from "@supabase/ssr";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = supabaseBrowserEnv();
  if (!env) {
    throw new Error("Supabase is not configured.");
  }

  return createBrowserClient(env.url, env.anonKey);
}
