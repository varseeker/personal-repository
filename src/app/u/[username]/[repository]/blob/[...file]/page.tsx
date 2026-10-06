import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { TextEditor } from "@/components/file-preview/text-editor";
import { MarkdownToc, MarkdownView } from "@/components/markdown/markdown-view";
import { getCurrentProfile } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { loadRepositoryView } from "@/lib/data/repository-view";
import { highlightCode } from "@/lib/highlight";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fileKind } from "@/lib/utils/file-kind";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { FileService } from "@/services/file.service";

export const dynamic = "force-dynamic";

type Params = { username: string; repository: string; file: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, repository, file } = await params;
  const name = decodeURIComponent(file.at(-1) ?? "File");
  const view = await loadRepositoryView(username, repository, file.slice(0, -1));
  const index = view.configured && !view.missing && view.repository.visibility === "public";
  return { title: name, robots: { index, follow: index } };
}

export default async function BlobPage({ params }: { params: Promise<Params> }) {
  const { username, repository, file: fileSegments } = await params;
  const view = await loadRepositoryView(username, repository, fileSegments.slice(0, -1));
  if (!view.configured || view.missing) notFound();
  const name = decodeURIComponent(fileSegments.at(-1) ?? "");
  const file = view.files.find((item) => item.name === name);
  if (!file) notFound();

  const kind = fileKind(file.mime_type, file.extension);
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  const textual = kind === "markdown" || kind === "text" || kind === "code" || kind === "spreadsheet" && file.extension === "csv";
  let text: string | null = null;
  if (textual && file.original_size <= appConfig.previewByteCap) {
    text = await FileService.readText(await createClient(), file).catch(() => null);
  }
  const highlighted = text && (kind === "code" || kind === "text") ? await highlightCode(text, file.extension) : null;

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell page-canvas" style={{ paddingBottom: "3rem" }}>
        <p className="muted">
          <Link href={`/u/${view.owner.username}/${view.repository.slug}`}>{view.repository.name}</Link>
          {view.breadcrumbs.slice(1).map((crumb) => <span key={crumb.href}> / <Link href={crumb.href}>{crumb.label}</Link></span>)}
          {" / "}{file.name}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h1 style={{ marginTop: "0.2rem" }}>{file.name}</h1>
          <a className="btn" href={`/api/files/${file.id}`}>Download</a>
        </div>
        <p className="muted">{formatBytes(file.original_size)} · {file.mime_type} · Updated {formatDate(file.updated_at)} · SHA-256 {file.checksum.slice(0, 12)}</p>
        {kind === "image" ? <img src={`/api/files/${file.id}?inline=1`} alt={file.name} style={{ maxWidth: "100%" }} /> : null}
        {kind === "pdf" ? <iframe title={file.name} src={`/api/files/${file.id}?inline=1`} style={{ width: "100%", minHeight: "70vh", border: 0 }} /> : null}
        {kind === "video" ? <video controls src={`/api/files/${file.id}?inline=1`} style={{ maxWidth: "100%" }} /> : null}
        {kind === "audio" ? <audio controls src={`/api/files/${file.id}?inline=1`} /> : null}
        {kind === "markdown" && text ? (
          <>
            <MarkdownToc markdown={text} />
            {view.canWrite ? <TextEditor repositoryId={view.repository.id} fileId={file.id} initial={text} markdown /> : <div className="card" style={{ padding: "1rem" }}><MarkdownView markdown={text} /></div>}
          </>
        ) : null}
        {highlighted ? <div className="card" style={{ padding: "0.4rem" }} dangerouslySetInnerHTML={{ __html: highlighted }} /> : null}
        {text && !highlighted && kind !== "markdown" ? <pre className="code-fallback"><code>{text}</code></pre> : null}
        {text && view.canWrite && kind !== "markdown" ? <TextEditor repositoryId={view.repository.id} fileId={file.id} initial={text} markdown={false} /> : null}
        {!text && !["image", "pdf", "video", "audio"].includes(kind) ? (
          <p className="card" style={{ padding: "1rem" }}>Preview is not available for this file. Download it to open it locally.</p>
        ) : null}
        {textual && !text ? <p className="muted">This file is too large to preview in the browser.</p> : null}
      </main>
    </>
  );
}
