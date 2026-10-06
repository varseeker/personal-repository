import "server-only";
import { getUserId } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { canPerform } from "@/lib/security/permissions";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { folderChain, folderOptions, resolveFolderPath } from "@/lib/utils/tree";
import { pickReadme } from "@/lib/utils/readme";
import { FileService } from "@/services/file.service";
import { FolderService } from "@/services/folder.service";
import { PermissionService } from "@/services/permission.service";
import { RepositoryService } from "@/services/repository.service";
import { UserService } from "@/services/user.service";
import type { RepoFile } from "@/types/file";
import type { Folder } from "@/types/folder";
import type { Repository } from "@/types/repository";
import type { Profile } from "@/types/user";
import type { RepoRole } from "@/lib/security/permissions";

export type RepositoryView =
  | { configured: false }
  | { configured: true; missing: true }
  | {
      configured: true;
      missing: false;
      owner: Profile;
      repository: Repository;
      role: RepoRole;
      canWrite: boolean;
      folders: Folder[];
      current: Folder | null;
      files: RepoFile[];
      childFolders: Folder[];
      readme: RepoFile | null;
      readmeText: string | null;
      breadcrumbs: { label: string; href: string }[];
      destinations: { id: string | null; label: string }[];
    };

export async function loadRepositoryView(username: string, slug: string, segments: string[]): Promise<RepositoryView> {
  if (!supabaseBrowserEnv()) return { configured: false };
  const supabase = await createClient();
  const owner = await UserService.getByUsername(supabase, username);
  if (!owner) return { configured: true, missing: true };

  const repository = await RepositoryService.getBySlug(supabase, owner.id, slug);
  if (!repository) return { configured: true, missing: true };

  const userId = await getUserId();
  const role = await PermissionService.roleFor(supabase, userId, repository);
  if (!canPerform(role, repository.visibility, "read")) return { configured: true, missing: true };

  const folders = await FolderService.list(supabase, repository.id);
  const current = segments.length > 0 ? resolveFolderPath(folders, segments) : null;
  if (segments.length > 0 && !current) return { configured: true, missing: true };

  const files = await FileService.listInFolder(supabase, repository.id, current?.id ?? null);
  const childFolders = folders.filter((folder) => folder.parent_folder_id === (current?.id ?? null));
  const readme = segments.length === 0 ? pickReadme(files) : null;
  let readmeText: string | null = null;
  if (readme && readme.original_size <= appConfig.previewByteCap) {
    try {
      readmeText = await FileService.readText(supabase, readme);
    } catch {
      readmeText = null;
    }
  }

  const chain = folderChain(folders, current?.id ?? null);
  const base = `/u/${owner.username}/${repository.slug}`;
  const breadcrumbs = [
    { label: repository.name, href: base },
    ...chain.map((folder, index) => ({
      label: folder.name,
      href: `${base}/tree/${chain.slice(0, index + 1).map((item) => encodeURIComponent(item.name)).join("/")}`,
    })),
  ];

  return {
    configured: true,
    missing: false,
    owner,
    repository,
    role,
    canWrite: canPerform(role, repository.visibility, "upload"),
    folders,
    current,
    files,
    childFolders,
    readme,
    readmeText,
    breadcrumbs,
    destinations: folderOptions(folders),
  };
}
