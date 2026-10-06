import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export async function createClient() {
  const env = supabaseBrowserEnv();
  if (!env) {
    throw new Error("Supabase is not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          void headers;
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}
