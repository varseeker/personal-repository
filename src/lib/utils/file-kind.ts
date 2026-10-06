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

const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "php", "java", "py", "cs", "sql",
  "html", "css", "scss", "json", "xml", "yaml", "yml", "go", "rs", "rb", "sh",
  "c", "cpp", "h", "toml",
]);

export function fileKind(mimeType: string, extension: string | null | undefined): FileKind {
  const mime = mimeType.toLowerCase();
  const ext = (extension ?? "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (ext === "md" || ext === "markdown" || mime === "text/markdown") return "markdown";
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || mime.includes("spreadsheet") || mime === "text/csv") {
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
  if (mime.startsWith("text/") || ["txt", "log"].includes(ext)) return "text";
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
