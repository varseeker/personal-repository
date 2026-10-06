const ALREADY_COMPRESSED = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "mp4",
  "m4v",
  "webm",
  "mov",
  "mp3",
  "aac",
  "ogg",
  "flac",
  "zip",
  "rar",
  "7z",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "br",
  "woff",
  "woff2",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
]);

const COMPRESSIBLE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "xml",
  "csv",
  "log",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "css",
  "scss",
  "html",
  "yml",
  "yaml",
  "sql",
  "py",
  "java",
  "cs",
  "php",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "rb",
  "sh",
  "toml",
  "ini",
  "svg",
  "env",
]);

const MIN_BYTES = 256;

export function shouldCompress(input: {
  mimeType: string;
  extension: string;
  size: number;
}): boolean {
  if (input.size < MIN_BYTES) return false;

  const extension = input.extension.toLowerCase();
  if (ALREADY_COMPRESSED.has(extension)) return false;
  if (COMPRESSIBLE_EXTENSIONS.has(extension)) return true;

  const mime = input.mimeType.toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json"
    || mime === "application/xml"
    || mime === "application/javascript"
    || mime === "application/x-yaml"
    || mime === "image/svg+xml"
  ) {
    return true;
  }

  return false;
}

export const compressionSavingsRatio = 0.95;
