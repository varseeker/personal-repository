"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidateRepository, requireRepositoryAccess } from "@/actions/access";
import { friendlyError, isNextRedirect, logServerError } from "@/lib/errors";
import { requireProfile } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { RepositoryService } from "@/services/repository.service";
import { StorageService } from "@/services/storage.service";
import type { ActionResult } from "@/types/action";

const repositorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000),
});

export async function createRepositoryAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = repositorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Enter a repository name." };

  try {
    const profile = await requireProfile();
    const ip = await clientIp();
    if (!(await rateLimit(`repo-create:${profile.id}:${ip}`, 20, 60 * 60))) {
      return { ok: false, error: "Too many repositories were created. Please wait and try again." };
    }

    const supabase = await createClient();
    const repository = await RepositoryService.create(supabase, profile.id, parsed.data);
    await revalidateRepository(supabase, repository);
    redirect(`/u/${profile.username}/${repository.slug}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    logServerError("create-repository", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function updateRepositoryAction(repositoryId: string, formData: FormData): Promise<ActionResult> {
  const parsed = repositorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Check the repository name and description." };

  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "update_settings");
    await RepositoryService.update(supabase, repository.id, parsed.data);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("update-repository", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function setVisibilityAction(repositoryId: string, visibility: "private" | "public", confirmed: boolean): Promise<ActionResult> {
  if (visibility === "public" && !confirmed) {
    return { ok: false, error: "Confirm that you want to make this repository public." };
  }

  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "change_visibility");
    await RepositoryService.setVisibility(supabase, repository.id, visibility);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("set-visibility", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteRepositoryAction(repositoryId: string, confirmation: string): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "delete_repository");
    if (confirmation !== repository.name) {
      return { ok: false, error: "Type the repository name to confirm deletion." };
    }
    const paths = await RepositoryService.delete(supabase, repository.id);
    await StorageService.remove(supabase, paths).catch((error: unknown) => {
      logServerError("delete-repository-storage", error);
    });
    await revalidateRepository(supabase, repository);
  } catch (error) {
    logServerError("delete-repository", error);
    return { ok: false, error: friendlyError(error) };
  }

  redirect("/dashboard");
}
