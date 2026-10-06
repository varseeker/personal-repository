import { z } from "zod";
import { zipResponse } from "@/lib/http/zip";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { descendantFolderIds, pathWithinFolder } from "@/lib/utils/tree";
import { FileService } from "@/services/file.service";
import { FolderService } from "@/services/folder.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await context.params;
  if (!z.uuid().safeParse(folderId).success) return new Response("Not found", { status: 404 });
  if (!(await rateLimit(`archive:${await clientIp()}`, 15, 60))) {
    return Response.json({ error: "Too many archive downloads. Please wait and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select("id, repository_id, parent_folder_id, name, created_at, updated_at").eq("id", folderId).maybeSingle();
  if (error || !data || typeof data !== "object" || !("repository_id" in data)) return new Response("Not found", { status: 404 });

  const repositoryId = String(data.repository_id);
  const folders = await FolderService.list(supabase, repositoryId);
  const ids = descendantFolderIds(folders, folderId);
  const files = await FileService.listAll(supabase, repositoryId);
  const entries = files
    .filter((file) => file.folder_id && ids.has(file.folder_id))
    .map((file) => ({
      file,
      relativePath: pathWithinFolder(folders, folderId, file.folder_id, file.name),
    }));

  return zipResponse(supabase, entries, `${String(data.name)}.zip`);
}
