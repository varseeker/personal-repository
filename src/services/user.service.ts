import "server-only";
import { AppError } from "@/lib/errors";
import { mapProfile } from "@/lib/mappers";
import { appConfig } from "@/lib/config";
import type { Profile } from "@/types/user";
import type { SupabaseClient } from "@supabase/supabase-js";

export const UserService = {
  async getByUsername(supabase: SupabaseClient, username: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, storage_limit_bytes, created_at, updated_at")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (error) throw new AppError("Unable to load that profile.");
    return mapProfile(data);
  },

  async update(
    supabase: SupabaseClient,
    userId: string,
    input: { displayName: string; username: string; bio: string },
  ): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: input.displayName,
        username: input.username,
        bio: input.bio || null,
      })
      .eq("id", userId)
      .select("id, username, display_name, avatar_url, bio, storage_limit_bytes, created_at, updated_at")
      .single();

    if (error || !data) throw error ?? new AppError("Unable to update your profile.");
    const profile = mapProfile(data);
    if (!profile) throw new AppError("Unable to update your profile.");
    return profile;
  },

  async setAvatarUrl(supabase: SupabaseClient, userId: string, avatarUrl: string): Promise<void> {
    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
    if (error) throw error;
  },

  avatarObjectPath(userId: string): string {
    return `${userId}/avatar`;
  },

  publicAvatarUrl(userId: string): string | null {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!base) return null;
    return `${base}/storage/v1/object/public/${appConfig.avatarsBucket}/${userId}/avatar`;
  },

  async storageUsed(supabase: SupabaseClient, userId: string): Promise<number> {
    const { data, error } = await supabase.from("files").select("stored_size").eq("owner_id", userId);
    if (error || !Array.isArray(data)) return 0;
    return data.reduce((sum, row) => {
      if (typeof row !== "object" || row === null || !("stored_size" in row)) return sum;
      return sum + Number(row.stored_size);
    }, 0);
  },
};
