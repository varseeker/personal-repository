import "server-only";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permission.service";
import { RepositoryService } from "@/services/repository.service";
import type { RepoAction } from "@/lib/security/permissions";
import type { Profile } from "@/types/user";
import type { Repository } from "@/types/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireRepositoryAccess(repositoryId: string, action: RepoAction): Promise<{
  supabase: SupabaseClient;
  profile: Profile;
  repository: Repository;
}> {
  const supabase = await createClient();
  const profile = await requireProfile();
  const repository = await RepositoryService.getById(supabase, repositoryId);
  if (!repository) throw new AppError("That repository was not found.");

  const role = await PermissionService.roleFor(supabase, profile.id, repository);
  if (!PermissionService.allows(role, repository, action)) {
    throw new AppError("You do not have permission to do that.");
  }

  return { supabase, profile, repository };
}

export async function revalidateRepository(supabase: SupabaseClient, repository: Repository): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", repository.owner_id)
    .maybeSingle();

  const username = data && typeof data === "object" && "username" in data && typeof data.username === "string"
    ? data.username
    : null;

  revalidatePath("/dashboard");
  revalidatePath("/public-repositories");
  if (username) revalidatePath(`/u/${username}/${repository.slug}`);
}
