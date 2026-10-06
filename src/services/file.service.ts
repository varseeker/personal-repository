import "server-only";
import { createHash } from "node:crypto";
import { appConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { mapFile, mapRows } from "@/lib/mappers";
import { fileExtension, normalizeMime, sanitizeFilename } from "@/lib/utils/filename";
import { CompressionService } from "@/services/compression.service";
import { StorageService } from "@/services/storage.service";
import type { RepoFile } from "@/types/file";
import type { SupabaseClient } from "@supabase/supabase-js";

const FILE_COLUMNS = "id, repository_id, folder_id, owner_id, name, original_name, storage_path, mime_type, extension, original_size, stored_size, compression_type, checksum, description, version, created_at, updated_at";

export type CommitFileInput = {
  repositoryId: string;
  folderId: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  originalSize: number;
  checksum: string;
  compressionType: "gzip" | null;
  fileId: string;
  replaceFileId?: string | null;
};

export const FileService = {
  async listInFolder(
    supabase: SupabaseClient,
    repositoryId: string,
    folderId: string | null,
  ): Promise<RepoFile[]> {
    let query = supabase
      .from("files")
      .select(FILE_COLUMNS)
      .eq("repository_id", repositoryId)
      .order("name", { ascending: true })
      .limit(200);

    query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
    const { data, error } = await query;
    if (error) throw new AppError("Unable to load files.");
    return mapRows(data, mapFile);
  },

  async listAll(supabase: SupabaseClient, repositoryId: string): Promise<RepoFile[]> {
    const { data, error } = await supabase
      .from("files")
      .select(FILE_COLUMNS)
      .eq("repository_id", repositoryId)
      .limit(2000);

    if (error) throw new AppError("Unable to load files.");
    return mapRows(data, mapFile);
  },

  async getById(supabase: SupabaseClient, fileId: string): Promise<RepoFile | null> {
    const { data, error } = await supabase.from("files").select(FILE_COLUMNS).eq("id", fileId).maybeSingle();
    if (error) throw new AppError("Unable to load that file.");
    return mapFile(data);
  },

  async namesInFolder(
    supabase: SupabaseClient,
    repositoryId: string,
    folderId: string | null,
  ): Promise<RepoFile[]> {
    return this.listInFolder(supabase, repositoryId, folderId);
  },

  storagePath(ownerId: string, repositoryId: string, fileId: string): string {
    return `${ownerId}/${repositoryId}/${fileId}`;
  },

  async commitUpload(supabase: SupabaseClient, ownerId: string, input: CommitFileInput): Promise<RepoFile> {
    const name = sanitizeFilename(input.name);
    if (!name) throw new AppError("That file name is not allowed.");
    if (!/^[a-f0-9]{64}$/.test(input.checksum)) throw new AppError("Unable to verify the file.");
    if (input.originalSize < 0 || input.originalSize > appConfig.maxUploadBytes) {
      throw new AppError("That file is too large.");
    }

    const extension = fileExtension(name);
    const mimeType = normalizeMime(input.mimeType, extension);

    if (input.replaceFileId) {
      const existing = await this.getById(supabase, input.replaceFileId);
      if (!existing || existing.repository_id !== input.repositoryId) {
        throw new AppError("The file to replace was not found.");
      }

      const { data, error } = await supabase
        .from("files")
        .update({
          name,
          original_name: sanitizeFilename(input.originalName) || name,
          mime_type: mimeType,
          extension: extension || null,
          original_size: input.originalSize,
          compression_type: input.compressionType,
          checksum: input.checksum,
        })
        .eq("id", existing.id)
        .select(FILE_COLUMNS)
        .single();

      if (error || !data) throw error ?? new AppError("Unable to replace the file.");
      const file = mapFile(data);
      if (!file) throw new AppError("Unable to replace the file.");
      return file;
    }

    const fileId = input.fileId;
    const storagePath = this.storagePath(ownerId, input.repositoryId, fileId);
    const { data, error } = await supabase
      .from("files")
      .insert({
        id: fileId,
        repository_id: input.repositoryId,
        folder_id: input.folderId,
        owner_id: ownerId,
        name,
        original_name: sanitizeFilename(input.originalName) || name,
        storage_path: storagePath,
        mime_type: mimeType,
        extension: extension || null,
        original_size: input.originalSize,
        stored_size: input.originalSize,
        compression_type: input.compressionType,
        checksum: input.checksum,
      })
      .select(FILE_COLUMNS)
      .single();

    if (error || !data) {
      await StorageService.remove(supabase, [storagePath]).catch(() => undefined);
      throw error ?? new AppError("Unable to save the file.");
    }

    const file = mapFile(data);
    if (!file) throw new AppError("Unable to save the file.");
    return file;
  },

  async createTextFile(
    supabase: SupabaseClient,
    ownerId: string,
    input: { repositoryId: string; folderId: string | null; name: string; content: string },
  ): Promise<RepoFile> {
    const name = sanitizeFilename(input.name);
    if (!name) throw new AppError("Enter a file name.");
    const bytes = Buffer.from(input.content, "utf8");
    if (bytes.byteLength > appConfig.previewByteCap) throw new AppError("That file is too large to create here.");

    const extension = fileExtension(name);
    const mimeType = normalizeMime("", extension);
    const compressed = CompressionService.compress(bytes, { mimeType, extension });
    const fileId = crypto.randomUUID();
    const storagePath = this.storagePath(ownerId, input.repositoryId, fileId);
    const checksum = createHash("sha256").update(bytes).digest("hex");

    await StorageService.upload(
      supabase,
      storagePath,
      compressed.bytes,
      compressed.compressionType ? "application/gzip" : mimeType,
      false,
    );

    return this.commitUpload(supabase, ownerId, {
      repositoryId: input.repositoryId,
      folderId: input.folderId,
      name,
      originalName: name,
      mimeType,
      originalSize: bytes.byteLength,
      checksum,
      compressionType: compressed.compressionType,
      fileId,
    });
  },

  async replaceText(
    supabase: SupabaseClient,
    file: RepoFile,
    content: string,
  ): Promise<void> {
    const bytes = Buffer.from(content, "utf8");
    if (bytes.byteLength > appConfig.previewByteCap) throw new AppError("That file is too large to save here.");
    const extension = file.extension ?? "";
    const compressed = CompressionService.compress(bytes, { mimeType: file.mime_type, extension });
    await StorageService.upload(
      supabase,
      file.storage_path,
      compressed.bytes,
      compressed.compressionType ? "application/gzip" : file.mime_type,
      true,
    );

    const checksum = createHash("sha256").update(bytes).digest("hex");
    const { error } = await supabase
      .from("files")
      .update({
        original_size: bytes.byteLength,
        compression_type: compressed.compressionType,
        checksum,
      })
      .eq("id", file.id);

    if (error) throw error;
  },

  async rename(supabase: SupabaseClient, fileId: string, name: string): Promise<void> {
    const safeName = sanitizeFilename(name);
    if (!safeName) throw new AppError("Enter a file name.");
    const { error } = await supabase
      .from("files")
      .update({ name: safeName, extension: fileExtension(safeName) || null })
      .eq("id", fileId);
    if (error) throw error;
  },

  async move(supabase: SupabaseClient, fileId: string, folderId: string | null): Promise<void> {
    const { error } = await supabase.from("files").update({ folder_id: folderId }).eq("id", fileId);
    if (error) throw error;
  },

  async delete(supabase: SupabaseClient, file: RepoFile): Promise<void> {
    const { error } = await supabase.from("files").delete().eq("id", file.id);
    if (error) throw error;
    await StorageService.remove(supabase, [file.storage_path]).catch(() => undefined);
  },

  async readText(supabase: SupabaseClient, file: RepoFile): Promise<string | null> {
    if (file.original_size > appConfig.previewByteCap) return null;
    const url = await StorageService.signedUrl(supabase, file.storage_path);
    const response = await fetch(url);
    if (!response.ok) throw new AppError("Unable to read the file.");
    const buffer = Buffer.from(await response.arrayBuffer());
    const bytes = file.compression_type === "gzip" ? CompressionService.decompress(buffer) : buffer;
    return bytes.toString("utf8");
  },
};
