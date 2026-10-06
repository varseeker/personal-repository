export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  storage_limit_bytes: number;
  created_at: string;
  updated_at: string;
};

export type PublicProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "bio" | "created_at">;
