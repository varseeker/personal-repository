"use server";

import { z } from "zod";
import { revalidateRepository, requireRepositoryAccess } from "@/actions/access";
import { appConfig } from "@/lib/config";
import { friendlyError, logServerError } from "@/lib/errors";
import { hasQuota } from "@/lib/security/permissions";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { FileService, type CommitFileInput } from "@/services/file.service";
import { RepositoryService } from "@/services/repository.service";
import { UserService } from "@/services/user.service";
import type { ActionResult } from "@/types/action";

const uuidSchema = z.uuid();

export async function prepareUploadAction(input: {
  repositoryId: string;
  incomingBytes: number;
}): Promise<ActionResult<{ remainingBytes: number }>> {
  if (!uuidSchema.safeParse(input.repositoryId).success || input.incomingBytes < 0) {
    return { ok: false, error: "Unable to start the upload." };
  }

  try {
    const { supabase, profile, repository } = await requireRepositoryAccess(input.repositoryId, "upload");
    const ip = await clientIp();
    if (!(await rateLimit(`upload:${profile.id}:${ip}`, 40, 60))) {
      return { ok: false, error: "Too many uploads. Please wait and try again." };
    }

    const [used, repoUsed] = await Promise.all([
      UserService.storageUsed(supabase, profile.id),
      RepositoryService.storedSize(supabase, repository.id),
    ]);
    const userRemaining = profile.storage_limit_bytes - used;
    const repoRemaining = repository.storage_limit_bytes - repoUsed;
    const remaining = Math.max(0, Math.min(userRemaining, repoRemaining));

    if (!hasQuota(Math.min(used, repoUsed), input.incomingBytes, Math.min(profile.storage_limit_bytes, repository.storage_limit_bytes))) {
      if (input.incomingBytes > remaining) return { ok: false, error: "Not enough storage space." };
    }
    if (input.incomingBytes > remaining) return { ok: false, error: "Not enough storage space." };
    if (input.incomingBytes > appConfig.maxUploadBytes) return { ok: false, error: "That file is too large." };

    return { ok: true, data: { remainingBytes: remaining } };
  } catch (error) {
    logServerError("prepare-upload", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function commitFileAction(input: CommitFileInput): Promise<ActionResult<{ id: string }>> {
  if (!uuidSchema.safeParse(input.repositoryId).success || !uuidSchema.safeParse(input.fileId).success) {
    return { ok: false, error: "Unable to save the file." };
  }
  if (input.folderId && !uuidSchema.safeParse(input.folderId).success) {
    return { ok: false, error: "Unable to save the file." };
  }

  try {
    const { supabase, profile, repository } = await requireRepositoryAccess(input.repositoryId, "upload");
    const file = await FileService.commitUpload(supabase, profile.id, input);
    await revalidateRepository(supabase, repository);
    return { ok: true, data: { id: file.id } };
  } catch (error) {
    logServerError("commit-file", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function createTextFileAction(input: {
  repositoryId: string;
  folderId: string | null;
  name: string;
  content: string;
}): Promise<ActionResult> {
  try {
    const { supabase, profile, repository } = await requireRepositoryAccess(input.repositoryId, "upload");
    await FileService.createTextFile(supabase, profile.id, input);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("create-text-file", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function replaceTextAction(repositoryId: string, fileId: string, content: string): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "upload");
    const file = await FileService.getById(supabase, fileId);
    if (!file || file.repository_id !== repository.id) return { ok: false, error: "That file was not found." };
    await FileService.replaceText(supabase, file, content);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("replace-text", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function renameFileAction(repositoryId: string, fileId: string, name: string): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "rename");
    await FileService.rename(supabase, fileId, name);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("rename-file", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function moveFileAction(repositoryId: string, fileId: string, folderId: string | null): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "move");
    await FileService.move(supabase, fileId, folderId);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("move-file", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteFileAction(repositoryId: string, fileId: string): Promise<ActionResult> {
  try {
    const { supabase, repository } = await requireRepositoryAccess(repositoryId, "delete_file");
    const file = await FileService.getById(supabase, fileId);
    if (!file || file.repository_id !== repository.id) return { ok: false, error: "That file was not found." };
    await FileService.delete(supabase, file);
    await revalidateRepository(supabase, repository);
    return { ok: true };
  } catch (error) {
    logServerError("delete-file", error);
    return { ok: false, error: friendlyError(error) };
  }
}
