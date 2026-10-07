export type FileKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "markdown"
  | "text"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "unknown";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico", "tif", "tiff", "heic",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "ogv", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus", "oga"]);
const TEXT_EXTENSIONS = new Set([
  "txt", "log", "rst", "tex", "adoc", "org", "me", "diff", "patch", "env", "ini", "conf",
  "cfg", "properties", "lock", "gitignore", "editorconfig",
]);
const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "php", "java", "py", "cs", "sql",
  "html", "css", "scss", "json", "xml", "yaml", "yml", "go", "rs", "rb", "sh",
  "c", "cpp", "h", "hpp", "toml", "vue", "svelte", "astro", "kt", "kts", "swift",
  "dart", "lua", "pl", "r", "scala", "ex", "exs", "hs", "clj", "elm", "erl",
  "fs", "nim", "zig", "sol", "graphql", "gql", "proto", "gradle", "ps1", "bat",
  "cmd", "prisma", "tf", "hcl",
]);

const PREVIEW_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  opus: "audio/opus",
  oga: "audio/ogg",
};

export function fileKind(mimeType: string, extension: string | null | undefined): FileKind {
  const mime = mimeType.toLowerCase();
  const ext = (extension ?? "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (ext === "md" || ext === "markdown" || ext === "mdx" || mime === "text/markdown") return "markdown";
  if (["xls", "xlsx", "csv", "tsv", "ods"].includes(ext) || mime.includes("spreadsheet") || mime === "text/csv" || mime === "text/tab-separated-values") {
    return "spreadsheet";
  }
  if (["doc", "docx", "odt", "rtf"].includes(ext) || mime.includes("wordprocessing")) return "document";
  if (["ppt", "pptx", "odp"].includes(ext) || mime.includes("presentation")) return "presentation";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("archive")) {
    return "archive";
  }
  if (CODE_EXTENSIONS.has(ext) || mime.includes("javascript") || mime.includes("json") || mime.includes("xml")) {
    return "code";
  }
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  return "unknown";
}

export function languageFromExtension(extension: string | null | undefined): string {
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    java: "java",
    cs: "csharp",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml",
    php: "php",
    go: "go",
    rs: "rust",
    rb: "ruby",
    sh: "bash",
    md: "markdown",
    markdown: "markdown",
  };
  return map[(extension ?? "").toLowerCase()] ?? "text";
}

export function isInlinePreview(kind: FileKind): boolean {
  return kind === "pdf" || kind === "image" || kind === "video" || kind === "audio";
}

export function previewContentType(mimeType: string, extension: string | null | undefined): string {
  const mime = mimeType.trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") return mimeType;
  return PREVIEW_MIME_BY_EXTENSION[(extension ?? "").toLowerCase()] ?? "application/octet-stream";
}
