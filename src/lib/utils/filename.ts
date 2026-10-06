export function sanitizeFilename(input: string): string {
  const base = input.split(/[/\\]/).pop() ?? "";
  const withoutControls = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const withoutDots = withoutControls.replace(/^\.+/, "");
  const safe = withoutDots.replace(/[<>:"|?*]/g, "_").replace(/\s+/g, " ").trim();

  if (!safe || safe === "." || safe === "..") return "";
  return safe.slice(0, 180);
}

export function fileExtension(name: string): string {
  const cleaned = sanitizeFilename(name);
  const dot = cleaned.lastIndexOf(".");
  if (dot <= 0 || dot === cleaned.length - 1) return "";
  return cleaned.slice(dot + 1).toLowerCase().slice(0, 16);
}

export function nextDuplicateName(name: string, existingLowerNames: Set<string>): string {
  if (!existingLowerNames.has(name.toLowerCase())) return name;

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 1;
  let candidate = `${stem} (${index})${extension}`;
  while (existingLowerNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${stem} (${index})${extension}`;
  }
  return candidate.slice(0, 180);
}

export function normalizeMime(mime: string, extension: string): string {
  const clean = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(clean)) return clean;
  return mimeFromExtension(extension);
}

export function mimeFromExtension(extension: string): string {
  const map: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    csv: "text/csv",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
    tsx: "text/tsx",
    jsx: "text/jsx",
    py: "text/x-python",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    zip: "application/zip",
  };
  return map[extension.toLowerCase()] ?? "application/octet-stream";
}
