import type { Folder } from "@/types/folder";

export function folderChain(folders: Folder[], folderId: string | null): Folder[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: Folder[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parent_folder_id ? byId.get(current.parent_folder_id) : undefined;
  }

  return chain.reverse();
}

export function resolveFolderPath(folders: Folder[], segments: string[]): Folder | null {
  let parentId: string | null = null;
  let current: Folder | null = null;

  for (const segment of segments) {
    const name = decodeURIComponent(segment);
    current = folders.find((folder) => folder.parent_folder_id === parentId && folder.name === name) ?? null;
    if (!current) return null;
    parentId = current.id;
  }

  return current;
}

export function descendantFolderIds(folders: Folder[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;

  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parent_folder_id && ids.has(folder.parent_folder_id) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }

  return ids;
}

export function pathWithinFolder(folders: Folder[], rootFolderId: string, folderId: string | null, name: string): string {
  const chain = folderChain(folders, folderId);
  const rootIndex = chain.findIndex((folder) => folder.id === rootFolderId);
  const relative = rootIndex >= 0 ? chain.slice(rootIndex + 1) : chain;
  return [...relative.map((folder) => folder.name), name].join("/");
}

export function relativeItemPath(folders: Folder[], folderId: string | null, name: string): string {
  const prefix = folderChain(folders, folderId).map((folder) => folder.name);
  return [...prefix, name].join("/");
}

export function folderOptions(folders: Folder[]): { id: string | null; label: string }[] {
  const options: { id: string | null; label: string }[] = [{ id: null, label: "Repository root" }];
  const sorted = [...folders].sort((a, b) => relativeItemPath(folders, a.parent_folder_id, a.name)
    .localeCompare(relativeItemPath(folders, b.parent_folder_id, b.name)));

  for (const folder of sorted) {
    options.push({
      id: folder.id,
      label: relativeItemPath(folders, folder.parent_folder_id, folder.name),
    });
  }

  return options;
}
