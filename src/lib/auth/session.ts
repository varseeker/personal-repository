import "server-only";
import { AppError, logServerError } from "@/lib/errors";
import { mapProfile } from "@/lib/mappers";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/user";

export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return data.claims.sub;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const { data: claims, error } = await supabase.auth.getClaims();
    if (error || !claims?.claims.sub) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, storage_limit_bytes, created_at, updated_at")
      .eq("id", claims.claims.sub)
      .maybeSingle();

    return mapProfile(data);
  } catch (error) {
    logServerError("session", error);
    return null;
  }
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AppError("You need to sign in.");
  return profile;
}
