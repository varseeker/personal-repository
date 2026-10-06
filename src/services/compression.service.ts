import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { compressionSavingsRatio, shouldCompress } from "@/lib/compression/should-compress";

export const CompressionService = {
  shouldCompress,

  compress(bytes: Buffer, meta: { mimeType: string; extension: string }): {
    bytes: Buffer;
    compressionType: "gzip" | null;
  } {
    if (!shouldCompress({ mimeType: meta.mimeType, extension: meta.extension, size: bytes.byteLength })) {
      return { bytes, compressionType: null };
    }

    const compressed = gzipSync(bytes, { level: 6 });
    if (compressed.byteLength < bytes.byteLength * compressionSavingsRatio) {
      return { bytes: compressed, compressionType: "gzip" };
    }

    return { bytes, compressionType: null };
  },

  decompress(bytes: Buffer): Buffer {
    return gunzipSync(bytes);
  },
};
