import type { ActivityEvent } from "@/types/activity";
import type { RepoFile } from "@/types/file";
import type { Folder } from "@/types/folder";
import type { PublicRepositoryCard, Repository, SearchHit } from "@/types/repository";
import type { Profile } from "@/types/user";

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapProfile(value: unknown): Profile | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.username !== "string") return null;
  return {
    id: row.id,
    username: row.username,
    display_name: text(row.display_name, row.username),
    avatar_url: nullableText(row.avatar_url),
    bio: nullableText(row.bio),
    storage_limit_bytes: number(row.storage_limit_bytes),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

export function mapRepository(value: unknown): Repository | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.slug !== "string") return null;
  return {
    id: row.id,
    owner_id: text(row.owner_id),
    name: text(row.name),
    slug: row.slug,
    description: nullableText(row.description),
    visibility: row.visibility === "public" ? "public" : "private",
    storage_limit_bytes: number(row.storage_limit_bytes),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

export function mapFolder(value: unknown): Folder | null {
  const row = record(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    repository_id: text(row.repository_id),
    parent_folder_id: nullableText(row.parent_folder_id),
    name: text(row.name),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

export function mapFile(value: unknown): RepoFile | null {
  const row = record(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    repository_id: text(row.repository_id),
    folder_id: nullableText(row.folder_id),
    owner_id: text(row.owner_id),
    name: text(row.name),
    original_name: text(row.original_name, text(row.name)),
    storage_path: text(row.storage_path),
    mime_type: text(row.mime_type, "application/octet-stream"),
    extension: nullableText(row.extension),
    original_size: number(row.original_size),
    stored_size: number(row.stored_size),
    compression_type: row.compression_type === "gzip" ? "gzip" : null,
    checksum: text(row.checksum),
    description: nullableText(row.description),
    version: number(row.version) || 1,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

export function mapPublicRepository(value: unknown): PublicRepositoryCard | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.slug !== "string") return null;
  return {
    id: row.id,
    name: text(row.name),
    slug: row.slug,
    description: nullableText(row.description),
    owner_username: text(row.owner_username),
    owner_display_name: text(row.owner_display_name),
    file_count: number(row.file_count),
    folder_count: number(row.folder_count),
    stored_bytes: number(row.stored_bytes),
    has_readme: row.has_readme === true,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

export function mapSearchHit(value: unknown): SearchHit | null {
  const row = record(value);
  if (!row || typeof row.item_id !== "string") return null;
  const kind = row.kind === "folder" || row.kind === "file" ? row.kind : "repository";
  return {
    kind,
    item_id: row.item_id,
    name: text(row.name),
    repository_id: text(row.repository_id),
    repository_name: text(row.repository_name),
    repository_slug: text(row.repository_slug),
    owner_username: text(row.owner_username),
    updated_at: text(row.updated_at),
  };
}

export function mapActivity(value: unknown): ActivityEvent | null {
  const row = record(value);
  if (!row || typeof row.id !== "string") return null;
  const metadata = record(row.metadata) ?? {};
  const safe: Record<string, string> = {};
  for (const [key, entry] of Object.entries(metadata)) {
    if (typeof entry === "string") safe[key] = entry;
  }
  return {
    id: row.id,
    actor_id: nullableText(row.actor_id),
    repository_id: nullableText(row.repository_id),
    event_type: text(row.event_type),
    metadata: safe,
    created_at: text(row.created_at),
  };
}

export function mapRows<T>(values: unknown, mapper: (value: unknown) => T | null): T[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const mapped = mapper(value);
    return mapped ? [mapped] : [];
  });
}
