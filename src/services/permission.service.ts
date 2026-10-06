import "server-only";
import { canPerform, resolveRole, type RepoAction, type RepoRole } from "@/lib/security/permissions";
import type { Repository } from "@/types/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PermissionService = {
  async roleFor(
    supabase: SupabaseClient,
    userId: string | null,
    repository: Repository,
  ): Promise<RepoRole> {
    if (!userId) return resolveRole({ userId, ownerId: repository.owner_id, collaboratorRole: null });
    if (userId === repository.owner_id) return "owner";

    const { data } = await supabase
      .from("repository_collaborators")
      .select("role")
      .eq("repository_id", repository.id)
      .eq("user_id", userId)
      .maybeSingle();

    const role = data && typeof data === "object" && "role" in data ? data.role : null;
    const collaboratorRole = role === "editor" || role === "viewer" ? role : null;
    return resolveRole({
      userId,
      ownerId: repository.owner_id,
      collaboratorRole,
    });
  },

  allows(role: RepoRole, repository: Repository, action: RepoAction): boolean {
    return canPerform(role, repository.visibility, action);
  },
};
