"use client";

import { useEffect, useState } from "react";
import { MarkdownToc, MarkdownView } from "@/components/markdown/markdown-view";
import { appConfig } from "@/lib/config";
import {
  decodeUtf8,
  extractOfficeText,
  hexDump,
  looksLikeText,
  parseDelimited,
  prettyJson,
  sniffMedia,
} from "@/lib/preview/content";
import { fileKind, previewContentType, type FileKind } from "@/lib/utils/file-kind";

export type PreviewFile = {
  id: string;
  name: string;
  mimeType: string;
  extension: string | null;
  originalSize: number;
};

type Loaded =
  | { mode: "text"; text: string; presentation: "markdown" | "table" | "code" }
  | { mode: "hex"; text: string }
  | { mode: "media"; kind: "image" | "pdf" | "audio" | "video"; src: string }
  | { mode: "empty" }
  | { mode: "too-large" }
  | { mode: "error"; message: string };

function mediaKind(kind: FileKind): "image" | "pdf" | "audio" | "video" | null {
  if (kind === "image" || kind === "pdf" || kind === "audio" || kind === "video") return kind;
  return null;
}

function textPresentation(extension: string | null, mimeType: string): "markdown" | "table" | "code" {
  const ext = (extension ?? "").toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "mdx" || mimeType === "text/markdown") return "markdown";
  if (ext === "csv" || ext === "tsv" || mimeType === "text/csv" || mimeType === "text/tab-separated-values") return "table";
  return "code";
}

export function FilePreview({ file }: { file: PreviewFile }) {
  const url = `/api/files/${file.id}?inline=1`;
  const kind = fileKind(file.mimeType, file.extension);
  const immediateMedia = mediaKind(kind);
  const streamMedia = Boolean(immediateMedia) && file.originalSize > appConfig.previewByteCap;
  const skipFetch = file.originalSize === 0 || streamMedia || file.originalSize > appConfig.previewByteCap;
  const staticPreview: Loaded | null = file.originalSize === 0
    ? { mode: "empty" }
    : streamMedia && immediateMedia
      ? { mode: "media", kind: immediateMedia, src: url }
      : file.originalSize > appConfig.previewByteCap
        ? { mode: "too-large" }
        : null;
  const [fetched, setFetched] = useState<{ id: string; loaded: Loaded } | null>(null);
  const loaded = staticPreview ?? (fetched?.id === file.id ? fetched.loaded : null);

  useEffect(() => {
    if (skipFetch) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const fileId = file.id;
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          setFetched({ id: fileId, loaded: { mode: "error", message: "Unable to load a preview of this file." } });
          return;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const sniffed = sniffMedia(bytes);
        const media = sniffed ?? (immediateMedia ? { kind: immediateMedia, mime: previewContentType(file.mimeType, file.extension) } : null);
        if (media) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: media.mime }));
          if (controller.signal.aborted) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setFetched({ id: fileId, loaded: { mode: "media", kind: media.kind, src: objectUrl } });
          return;
        }
        const office = await extractOfficeText(bytes, file.extension ?? "");
        if (controller.signal.aborted) return;
        if (office) {
          setFetched({ id: fileId, loaded: { mode: "text", text: office, presentation: "code" } });
          return;
        }
        if (looksLikeText(bytes)) {
          const text = decodeUtf8(bytes);
          const presentation = textPresentation(file.extension, file.mimeType);
          const formatted = presentation === "code" && ((file.extension ?? "").toLowerCase() === "json" || file.mimeType.includes("json"))
            ? prettyJson(text) ?? text
            : text;
          setFetched({ id: fileId, loaded: { mode: "text", text: formatted, presentation } });
          return;
        }
        setFetched({ id: fileId, loaded: { mode: "hex", text: hexDump(bytes) } });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFetched({ id: fileId, loaded: { mode: "error", message: "Unable to load a preview of this file." } });
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.extension, file.id, file.mimeType, immediateMedia, skipFetch, url]);

  if (!loaded) return <p className="muted preview-status">Loading preview…</p>;
  if (loaded.mode === "empty") return <p className="muted preview-status">This file is empty.</p>;
  if (loaded.mode === "too-large") return <p className="muted preview-status">This file is too large to preview here. Download it to open it locally.</p>;
  if (loaded.mode === "error") return <p className="form-error preview-status">{loaded.message}</p>;
  if (loaded.mode === "media") {
    if (loaded.kind === "image") return <img src={loaded.src} alt={file.name} />;
    if (loaded.kind === "pdf") return <iframe title={file.name} src={loaded.src} className="preview-frame" />;
    if (loaded.kind === "video") return <video controls src={loaded.src} />;
    return <audio controls src={loaded.src} />;
  }
  if (loaded.mode === "hex") {
    return (
      <div>
        <p className="muted">This file is binary. The first bytes are shown below.</p>
        <pre className="code-fallback"><code>{loaded.text}</code></pre>
      </div>
    );
  }
  if (loaded.presentation === "markdown") {
    return (
      <div>
        <MarkdownToc markdown={loaded.text} />
        <div className="card preview-card"><MarkdownView markdown={loaded.text} /></div>
      </div>
    );
  }
  if (loaded.presentation === "table") {
    const delimiter = (file.extension ?? "").toLowerCase() === "tsv" || file.mimeType === "text/tab-separated-values" ? "\t" : ",";
    const rows = parseDelimited(loaded.text, delimiter);
    return (
      <div className="preview-table-wrap">
        <table className="preview-table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <pre className="code-fallback"><code>{loaded.text}</code></pre>;
}
