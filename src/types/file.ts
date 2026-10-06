export type CompressionType = "gzip" | null;

export type RepoFile = {
  id: string;
  repository_id: string;
  folder_id: string | null;
  owner_id: string;
  name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  extension: string | null;
  original_size: number;
  stored_size: number;
  compression_type: CompressionType;
  checksum: string;
  description: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FileBrowserItem = {
  kind: "folder" | "file";
  id: string;
  name: string;
  updated_at: string;
  mime_type?: string;
  extension?: string | null;
  original_size?: number;
  stored_size?: number;
  compression_type?: CompressionType;
};
