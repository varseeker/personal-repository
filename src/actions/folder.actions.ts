"use server";

import { z } from "zod";
import { revalidateRepository, requireRepositoryAccess } from "@/actions/access";
import { friendlyError, logServerError } from "@/lib/errors";
import { FolderService } from "@/services/folder.service";
import { StorageService } from "@/services/storage.service";
import type { ActionResult } from "@/types/action";

const nameSchema = z.string().trim().min(1).max(120);
const uuidSchema = z.uuid();

export async function createFolderAction(input: {
  repositoryId: string;
  parentFolderId: string | null;
  name: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!uuidSchema.safeParse(input.repositoryId).success) return { ok: false, error: "Unable to create the folder." };
  if (input.parentFolderId && !uuidSchema.safeParse(input.parentFolderId).success) {
    return { ok: false, error: "Unable to create the folder." };
  }
  if (!nameSchema.safeParse(input.name).success) return { ok: false, error: "Enter a folder name." };

  try {
    const { supabase, repository } = await requireRepositoryAccess(input.repositoryId, "create_folder");
    const folder = await FolderService.create(supabase, repository.id, input.parentFolderId, input.name);
    await revalidateRepository(supabase, repository);
    return { ok: true, data: { id: folder.id } };
  } catch (error) {
    logServerError("create-folder", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function ensureFolderPathAction(input: {
  repositoryId: string;
  parentFolderId: string | null;
  relativeDirectory: string;
}): Promise<ActionResult<{ folderId: string | null }>> {
  if (!uuidSchema.safeParse(input.repositoryId).success) return { ok: false, error: "Unable to create folders." };
  if (input.relativeDirectory.includes("..") || input.relativeDirectory.includes("\\")) {
    return { ok: false, error: "That folder path is not allowed." };
  }

  try {
    const { supabase, repository } = await requireRepositoryAccess(input.repositoryId, "create_folder");
    const folderId = await FolderService.ensurePath(
      supabase,
      repository.id,
      input.parentFolderId,
      input.relativeDirectory,
    );
    await revalidateRepository(supabase, repository);
    return { ok: true, data: { folderId } };
  } catch (error) {
    logServerError("ensure-folder", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function renameFolderAction(repositoryId: string, folderId: string, name: string): Promise<ActionResult> {
  if (!nameSchema.safeParse(name).success) return { ok: false, error: "Enter a folder name." };

  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "rename");
    await FolderService.rename(supabase, folderId, name);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("rename-folder", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function moveFolderAction(
  repositoryId: string,
  folderId: string,
  parentFolderId: string | null,
): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "move");
    await FolderService.move(supabase, folderId, parentFolderId);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("move-folder", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteFolderAction(repositoryId: string, folderId: string): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "delete_folder");
    const paths = await FolderService.delete(supabase, repository.id, folderId);
    await StorageService.remove(supabase, paths).catch((error: unknown) => {
      logServerError("delete-folder-storage", error);
    });
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("delete-folder", error);
    return { ok: false, error: friendlyError(error) };
  }
}
