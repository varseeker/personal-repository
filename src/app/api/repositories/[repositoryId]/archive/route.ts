import { z } from "zod";
import { zipResponse } from "@/lib/http/zip";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { relativeItemPath } from "@/lib/utils/tree";
import { FileService } from "@/services/file.service";
import { FolderService } from "@/services/folder.service";
import { RepositoryService } from "@/services/repository.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await context.params;
  if (!z.uuid().safeParse(repositoryId).success) return new Response("Not found", { status: 404 });
  if (!(await rateLimit(`archive:${await clientIp()}`, 10, 60))) {
    return Response.json({ error: "Too many archive downloads. Please wait and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const repository = await RepositoryService.getById(supabase, repositoryId);
  if (!repository) return new Response("Not found", { status: 404 });
  const [folders, files] = await Promise.all([
    FolderService.list(supabase, repository.id),
    FileService.listAll(supabase, repository.id),
  ]);

  return zipResponse(
    supabase,
    files.map((file) => ({ file, relativePath: relativeItemPath(folders, file.folder_id, file.name) })),
    `${repository.slug}.zip`,
  );
}
