export type Visibility = "private" | "public";

export type Repository = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: Visibility;
  storage_limit_bytes: number;
  created_at: string;
  updated_at: string;
};

export type PublicRepositoryCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_username: string;
  owner_display_name: string;
  file_count: number;
  folder_count: number;
  stored_bytes: number;
  has_readme: boolean;
  created_at: string;
  updated_at: string;
};

export type SearchHit = {
  kind: "repository" | "folder" | "file";
  item_id: string;
  name: string;
  repository_id: string;
  repository_name: string;
  repository_slug: string;
  owner_username: string;
  updated_at: string;
};
