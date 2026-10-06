import "server-only";
import { mapActivity, mapRows } from "@/lib/mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import type { ActivityEvent } from "@/types/activity";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ActivityService = {
  async recent(supabase: SupabaseClient, limit = 8): Promise<ActivityEvent[]> {
    const { data, error } = await supabase
      .from("activity_events")
      .select("id, actor_id, repository_id, event_type, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return mapRows(data, mapActivity);
  },

  async logDownload(input: { actorId: string | null; repositoryId: string; fileId: string; name: string }): Promise<void> {
    const admin = createAdminClient();
    if (!admin) return;

    const { error } = await admin.from("activity_events").insert({
      actor_id: input.actorId,
      repository_id: input.repositoryId,
      event_type: "file_downloaded",
      metadata: { name: input.name, file_id: input.fileId },
    });

    if (error) logServerError("activity-download", error);
  },
};
