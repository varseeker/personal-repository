export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 8000));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.08;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function prettyJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.slice(0, 200);
}

export function hexDump(bytes: Uint8Array, limit = 4096): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, limit));
  const lines: string[] = [];
  for (let offset = 0; offset < slice.length; offset += 16) {
    const chunk = slice.subarray(offset, offset + 16);
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(16 * 3 - 1, " ");
    const ascii = [...chunk].map((byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".")).join("");
    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  if (bytes.length > slice.length) lines.push(`… ${bytes.length - slice.length} more bytes`);
  return lines.join("\n");
}

export type SniffedMedia = { kind: "image" | "pdf" | "audio" | "video"; mime: string };

export function sniffMedia(bytes: Uint8Array): SniffedMedia | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { kind: "image", mime: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { kind: "image", mime: "image/gif" };
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { kind: "image", mime: "image/webp" };
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { kind: "pdf", mime: "application/pdf" };
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return { kind: "audio", mime: "audio/wav" };
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return { kind: "audio", mime: "audio/mpeg" };
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return { kind: "audio", mime: "audio/ogg" };
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { kind: "video", mime: "video/mp4" };
  return null;
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/si>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function zipView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function findZipCentralDirectory(data: Uint8Array): { offset: number; count: number } | null {
  const view = zipView(data);
  const earliest = Math.max(0, data.length - (22 + 0xffff));
  for (let offset = data.length - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    return { offset: view.getUint32(offset + 16, true), count: view.getUint16(offset + 10, true) };
  }
  return null;
}

async function readCompressed(data: Uint8Array, method: number, start: number, size: number): Promise<Uint8Array | null> {
  if (size < 0 || start < 0 || start + size > data.length) return null;
  const compressed = data.subarray(start, start + size);
  if (method === 0) return compressed;
  if (method === 8) return inflateRaw(compressed);
  return null;
}

async function readZipEntries(data: Uint8Array, names: string[]): Promise<Map<string, Uint8Array>> {
  const wanted = new Set(names);
  const found = new Map<string, Uint8Array>();
  const view = zipView(data);
  const central = findZipCentralDirectory(data);
  if (central) {
    let offset = central.offset;
    for (let index = 0; index < central.count && offset + 46 <= data.length && found.size < wanted.size; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = new TextDecoder().decode(data.subarray(offset + 46, offset + 46 + nameLength));
      if (wanted.has(name) && localOffset + 30 <= data.length && view.getUint32(localOffset, true) === 0x04034b50) {
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const bytes = await readCompressed(data, method, dataStart, compressedSize);
        if (bytes) found.set(name, bytes);
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (found.size > 0) return found;
  }

  let offset = 0;
  while (offset + 30 <= data.length && found.size < wanted.size) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    if ((flags & 0x8) !== 0 && compressedSize === 0) break;
    if (dataStart + compressedSize > data.length) break;
    const name = new TextDecoder().decode(data.subarray(nameStart, nameStart + nameLength));
    if (wanted.has(name)) {
      const bytes = await readCompressed(data, method, dataStart, compressedSize);
      if (bytes) found.set(name, bytes);
    }
    offset = dataStart + compressedSize;
  }
  return found;
}

export async function extractOfficeText(bytes: Uint8Array, extension: string): Promise<string | null> {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  const ext = extension.toLowerCase();
  const names = ext === "docx"
    ? ["word/document.xml"]
    : ext === "xlsx"
      ? ["xl/sharedStrings.xml"]
      : ext === "pptx"
        ? Array.from({ length: 20 }, (_, index) => `ppt/slides/slide${index + 1}.xml`)
        : ext === "odt" || ext === "ods" || ext === "odp"
          ? ["content.xml"]
          : [];
  if (names.length === 0) return null;
  try {
    const entries = await readZipEntries(bytes, names);
    const parts = names
      .map((name) => entries.get(name))
      .filter((entry): entry is Uint8Array => Boolean(entry))
      .map((entry) => xmlToText(decodeUtf8(entry)))
      .filter(Boolean);
    return parts.length > 0 ? parts.join("\n\n") : null;
  } catch {
    return null;
  }
}
