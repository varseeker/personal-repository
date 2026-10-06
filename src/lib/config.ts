const STORAGE_HARD_CAP_BYTES = 52_428_800;

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export const appConfig = {
  maxUploadBytes: Math.min(
    readPositiveInt("MAX_UPLOAD_BYTES", STORAGE_HARD_CAP_BYTES),
    STORAGE_HARD_CAP_BYTES,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000",
  filesBucket: "repository-files",
  avatarsBucket: "avatars",
  archiveFileCap: 200,
  archiveByteCap: 100 * 1024 * 1024,
  previewByteCap: 1_000_000,
  authProviders: (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is "github" | "google" => provider === "github" || provider === "google"),
};

export const storageHardCapBytes = STORAGE_HARD_CAP_BYTES;
