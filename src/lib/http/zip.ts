import "server-only";
import { createGunzip } from "node:zlib";
import { Readable, PassThrough } from "node:stream";
import { appConfig } from "@/lib/config";
import { StorageService } from "@/services/storage.service";
import type { RepoFile } from "@/types/file";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ZipEntry = { file: RepoFile; relativePath: string };

export async function zipResponse(
  supabase: SupabaseClient,
  entries: ZipEntry[],
  downloadName: string,
): Promise<Response> {
  const total = entries.reduce((sum, entry) => sum + entry.file.original_size, 0);
  if (entries.length > appConfig.archiveFileCap || total > appConfig.archiveByteCap) {
    return Response.json(
      { error: "That folder is too large to download as one archive. Download files individually." },
      { status: 413 },
    );
  }

  const { default: createArchive } = await import("archiver");
  const archive = createArchive("zip", { zlib: { level: 1 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  for (const entry of entries) {
    const url = await StorageService.signedUrl(supabase, entry.file.storage_path);
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) continue;
    const source = Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream);
    const stream = entry.file.compression_type === "gzip" ? source.pipe(createGunzip()) : source;
    archive.append(stream, { name: entry.relativePath });
  }

  void archive.finalize();

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${downloadName.replace(/[^\w.\- ()]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
