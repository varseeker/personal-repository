declare module "archiver" {
  import type { Readable, Writable } from "node:stream";

  interface ZipArchive {
    append(source: Readable, data: { name: string }): void;
    pipe(destination: Writable): Writable;
    finalize(): void;
  }

  function createArchive(format: "zip", options?: { zlib?: { level?: number } }): ZipArchive;
  export default createArchive;
}
