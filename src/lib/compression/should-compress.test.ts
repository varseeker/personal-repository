import { describe, expect, it } from "vitest";
import { shouldCompress } from "@/lib/compression/should-compress";

describe("shouldCompress", () => {
  it("skips formats that are already compressed", () => {
    for (const extension of ["jpg", "png", "mp4", "mp3", "zip", "webp", "pdf"]) {
      expect(shouldCompress({ mimeType: "application/octet-stream", extension, size: 10_000 })).toBe(false);
    }
  });

  it("compresses text, markdown, data, and source files", () => {
    expect(shouldCompress({ mimeType: "text/plain", extension: "txt", size: 4_000 })).toBe(true);
    expect(shouldCompress({ mimeType: "text/markdown", extension: "md", size: 4_000 })).toBe(true);
    expect(shouldCompress({ mimeType: "application/json", extension: "json", size: 4_000 })).toBe(true);
    expect(shouldCompress({ mimeType: "text/plain", extension: "ts", size: 4_000 })).toBe(true);
  });

  it("does not compress tiny files", () => {
    expect(shouldCompress({ mimeType: "text/plain", extension: "txt", size: 20 })).toBe(false);
  });
});
