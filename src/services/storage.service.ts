import "server-only";
import { appConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const StorageService = {
  async upload(
    supabase: SupabaseClient,
    path: string,
    body: Buffer,
    contentType: string,
    upsert: boolean,
  ): Promise<void> {
    const { error } = await supabase.storage.from(appConfig.filesBucket).upload(path, body, {
      contentType,
      upsert,
    });
    if (error) throw new AppError("Unable to store the file.");
  },

  async remove(supabase: SupabaseClient, paths: string[]): Promise<void> {
    const unique = [...new Set(paths.filter(Boolean))];
    for (let index = 0; index < unique.length; index += 100) {
      const chunk = unique.slice(index, index + 100);
      const { error } = await supabase.storage.from(appConfig.filesBucket).remove(chunk);
      if (error) throw new AppError("Unable to delete stored files.");
    }
  },

  async signedUrl(supabase: SupabaseClient, path: string, expiresIn = 60): Promise<string> {
    const client = createAdminClient() ?? supabase;
    const { data, error } = await client.storage.from(appConfig.filesBucket).createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) throw new AppError("Unable to read the file.");
    return data.signedUrl;
  },
};
