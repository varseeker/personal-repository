import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseBrowserEnv, supabaseServiceKey } from "@/lib/supabase/env";

export function createAdminClient() {
  const env = supabaseBrowserEnv();
  const serviceKey = supabaseServiceKey();
  if (!env || !serviceKey) return null;

  return createClient(env.url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
