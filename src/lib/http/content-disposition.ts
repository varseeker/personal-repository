export function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const fallback = filename.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "download";
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
