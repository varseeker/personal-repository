import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { z } from "zod";
import { getUserId } from "@/lib/auth/session";
import { contentDisposition } from "@/lib/http/content-disposition";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { fileKind, isInlinePreview, previewContentType } from "@/lib/utils/file-kind";
import { ActivityService } from "@/services/activity.service";
import { FileService } from "@/services/file.service";
import { StorageService } from "@/services/storage.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  if (!z.uuid().safeParse(fileId).success) return new Response("Not found", { status: 404 });

  const ip = await clientIp();
  if (!(await rateLimit(`download:${ip}`, 80, 60))) {
    return Response.json({ error: "Too many downloads. Please wait and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const file = await FileService.getById(supabase, fileId);
  if (!file) return new Response("Not found", { status: 404 });

  const signed = await StorageService.signedUrl(supabase, file.storage_path);
  const upstream = await fetch(signed);
  if (!upstream.ok || !upstream.body) return new Response("Unable to download that file.", { status: 502 });

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const kind = fileKind(file.mime_type, file.extension);
  const disposition = inline ? "inline" : "attachment";
  const sandboxMedia = inline && isInlinePreview(kind);
  const source = Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream);
  const body = file.compression_type === "gzip" ? source.pipe(createGunzip()) : source;

  const userId = await getUserId();
  void ActivityService.logDownload({
    actorId: userId,
    repositoryId: file.repository_id,
    fileId: file.id,
    name: file.name,
  });

  return new Response(Readable.toWeb(body) as ReadableStream, {
    headers: {
      "Content-Type": previewContentType(file.mime_type, file.extension),
      "Content-Disposition": contentDisposition(disposition, file.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(sandboxMedia ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" }),
    },
  });
}
