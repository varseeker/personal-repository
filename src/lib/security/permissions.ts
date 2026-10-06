export type Visibility = "private" | "public";
export type CollaboratorRole = "editor" | "viewer";
export type RepoRole = "owner" | "editor" | "viewer" | "none";

export type RepoAction =
  | "read"
  | "download"
  | "preview"
  | "upload"
  | "create_folder"
  | "rename"
  | "move"
  | "delete_file"
  | "delete_folder"
  | "update_settings"
  | "change_visibility"
  | "delete_repository";

const WRITE_ACTIONS = new Set<RepoAction>([
  "upload",
  "create_folder",
  "rename",
  "move",
  "delete_file",
  "delete_folder",
]);

const OWNER_ACTIONS = new Set<RepoAction>([
  "update_settings",
  "change_visibility",
  "delete_repository",
]);

export function resolveRole(input: {
  userId: string | null;
  ownerId: string;
  collaboratorRole: CollaboratorRole | null;
}): RepoRole {
  if (input.userId && input.userId === input.ownerId) return "owner";
  if (input.collaboratorRole) return input.collaboratorRole;
  return "none";
}

export function canPerform(role: RepoRole, visibility: Visibility, action: RepoAction): boolean {
  if (OWNER_ACTIONS.has(action)) return role === "owner";
  if (WRITE_ACTIONS.has(action)) return role === "owner" || role === "editor";
  return visibility === "public" || role !== "none";
}

export function hasQuota(used: number, incoming: number, limit: number): boolean {
  return Number.isFinite(used) && Number.isFinite(incoming) && Number.isFinite(limit)
    && incoming >= 0
    && used >= 0
    && limit >= 0
    && used + incoming <= limit;
}
