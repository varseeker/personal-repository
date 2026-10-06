import "server-only";
import { AppError } from "@/lib/errors";
import { mapFolder, mapRows } from "@/lib/mappers";
import { descendantFolderIds } from "@/lib/utils/tree";
import { sanitizeFilename } from "@/lib/utils/filename";
import type { Folder } from "@/types/folder";
import type { SupabaseClient } from "@supabase/supabase-js";

const FOLDER_COLUMNS = "id, repository_id, parent_folder_id, name, created_at, updated_at";

export const FolderService = {
  async list(supabase: SupabaseClient, repositoryId: string): Promise<Folder[]> {
    const { data, error } = await supabase
      .from("folders")
      .select(FOLDER_COLUMNS)
      .eq("repository_id", repositoryId)
      .order("name", { ascending: true })
      .limit(2000);

    if (error) throw new AppError("Unable to load folders.");
    return mapRows(data, mapFolder);
  },

  async create(
    supabase: SupabaseClient,
    repositoryId: string,
    parentFolderId: string | null,
    name: string,
  ): Promise<Folder> {
    const safeName = sanitizeFilename(name);
    if (!safeName) throw new AppError("Enter a folder name.");

    const { data, error } = await supabase
      .from("folders")
      .insert({
        repository_id: repositoryId,
        parent_folder_id: parentFolderId,
        name: safeName,
      })
      .select(FOLDER_COLUMNS)
      .single();

    if (error || !data) throw error ?? new AppError("Unable to create the folder.");
    const folder = mapFolder(data);
    if (!folder) throw new AppError("Unable to create the folder.");
    return folder;
  },

  async ensurePath(
    supabase: SupabaseClient,
    repositoryId: string,
    parentFolderId: string | null,
    relativeDirectory: string,
  ): Promise<string | null> {
    const segments = relativeDirectory.split("/").map((segment) => segment.trim()).filter(Boolean);
    let currentParent = parentFolderId;
    const folders = await this.list(supabase, repositoryId);

    for (const segment of segments) {
      const safeName = sanitizeFilename(segment);
      if (!safeName) throw new AppError("That folder name is not allowed.");
      const existing = folders.find((folder) => folder.parent_folder_id === currentParent && folder.name.toLowerCase() === safeName.toLowerCase());
      if (existing) {
        currentParent = existing.id;
        continue;
      }
      const created = await this.create(supabase, repositoryId, currentParent, safeName);
      folders.push(created);
      currentParent = created.id;
    }

    return currentParent;
  },

  async rename(supabase: SupabaseClient, folderId: string, name: string): Promise<void> {
    const safeName = sanitizeFilename(name);
    if (!safeName) throw new AppError("Enter a folder name.");
    const { error } = await supabase.from("folders").update({ name: safeName }).eq("id", folderId);
    if (error) throw error;
  },

  async move(supabase: SupabaseClient, folderId: string, parentFolderId: string | null): Promise<void> {
    const { error } = await supabase.from("folders").update({ parent_folder_id: parentFolderId }).eq("id", folderId);
    if (error) throw error;
  },

  async delete(supabase: SupabaseClient, repositoryId: string, folderId: string): Promise<string[]> {
    const folders = await this.list(supabase, repositoryId);
    const ids = descendantFolderIds(folders, folderId);
    const { data, error: listError } = await supabase
      .from("files")
      .select("storage_path, folder_id")
      .eq("repository_id", repositoryId);

    if (listError) throw new AppError("Unable to delete the folder.");

    const paths = mapRows(data, (row) => {
      if (typeof row !== "object" || row === null || !("storage_path" in row) || !("folder_id" in row)) return null;
      const folder = typeof row.folder_id === "string" ? row.folder_id : null;
      if (!folder || !ids.has(folder)) return null;
      return typeof row.storage_path === "string" ? row.storage_path : null;
    });

    const { error } = await supabase.from("folders").delete().eq("id", folderId);
    if (error) throw error;
    return paths;
  },
};
