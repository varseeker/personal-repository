import { describe, expect, it } from "vitest";
import { extractOfficeText, hexDump, looksLikeText, parseDelimited, prettyJson, sniffMedia } from "@/lib/preview/content";
import { fileKind, previewContentType } from "@/lib/utils/file-kind";

describe("file preview classification", () => {
  it("recognizes media from the extension when the mime type is generic", () => {
    expect(fileKind("application/octet-stream", "png")).toBe("image");
    expect(fileKind("application/octet-stream", "mp4")).toBe("video");
    expect(fileKind("application/octet-stream", "wav")).toBe("audio");
    expect(fileKind("application/octet-stream", "vue")).toBe("code");
    expect(fileKind("application/octet-stream", "mdx")).toBe("markdown");
  });

  it("treats printable bytes as text and rejects binary", () => {
    expect(looksLikeText(new TextEncoder().encode("hello\nworld"))).toBe(true);
    expect(looksLikeText(Uint8Array.from([0x00, 0x01, 0x02, 0xff]))).toBe(false);
  });

  it("formats json, delimited text, and a hex dump", () => {
    expect(prettyJson('{"b":1}')).toBe('{\n  "b": 1\n}');
    expect(parseDelimited('name,"a,b"\nAda,1\n', ",")).toEqual([
      ["name", "a,b"],
      ["Ada", "1"],
    ]);
    expect(hexDump(Uint8Array.from([0x41, 0x00]))).toContain("41 00");
  });

  it("sniffs media bytes and fills a generic mime type from the extension", () => {
    expect(sniffMedia(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))?.mime).toBe("image/png");
    expect(previewContentType("application/octet-stream", "png")).toBe("image/png");
    expect(previewContentType("text/plain", "png")).toBe("text/plain");
  });

  it("reads a docx entry whose size is stored in the central directory", async () => {
    const name = new TextEncoder().encode("word/document.xml");
    const payload = new TextEncoder().encode("<w:p><w:t>Opened here</w:t></w:p>");
    const local = 30 + name.length;
    const descriptor = 16;
    const central = 46 + name.length;
    const bytes = new Uint8Array(local + payload.length + descriptor + central + 22);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(6, 0x8, true);
    view.setUint16(26, name.length, true);
    bytes.set(name, 30);
    bytes.set(payload, local);
    const descriptorAt = local + payload.length;
    view.setUint32(descriptorAt, 0x08074b50, true);
    view.setUint32(descriptorAt + 8, payload.length, true);
    view.setUint32(descriptorAt + 12, payload.length, true);
    const centralAt = descriptorAt + descriptor;
    view.setUint32(centralAt, 0x02014b50, true);
    view.setUint16(centralAt + 8, 0x8, true);
    view.setUint32(centralAt + 20, payload.length, true);
    view.setUint32(centralAt + 24, payload.length, true);
    view.setUint16(centralAt + 28, name.length, true);
    bytes.set(name, centralAt + 46);
    const eocdAt = centralAt + central;
    view.setUint32(eocdAt, 0x06054b50, true);
    view.setUint16(eocdAt + 8, 1, true);
    view.setUint16(eocdAt + 10, 1, true);
    view.setUint32(eocdAt + 12, central, true);
    view.setUint32(eocdAt + 16, centralAt, true);
    expect(await extractOfficeText(bytes, "docx")).toBe("Opened here");
  });

  it("reads text out of a stored docx entry", async () => {
    const xml = "<w:p>Hello <w:t>world</w:t></w:p>";
    const name = new TextEncoder().encode("word/document.xml");
    const data = new TextEncoder().encode(xml);
    const bytes = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    bytes.set(name, 30);
    bytes.set(data, 30 + name.length);
    expect(await extractOfficeText(bytes, "docx")).toBe("Hello world");
  });
});