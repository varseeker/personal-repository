import Link from "next/link";
import { FileBrowser } from "@/components/file-browser/file-browser";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { appConfig } from "@/lib/config";
import type { RepositoryView } from "@/lib/data/repository-view";

export function RepositoryScreen({ view }: { view: Extract<RepositoryView, { missing: false }> }) {
  const { repository, owner } = view;
  return (
    <div className="shell page-canvas" style={{ paddingBottom: "3rem" }}>
      <header style={{ padding: "1.4rem 0 1rem" }}>
        <p className="muted" style={{ marginBottom: "0.3rem" }}>
          <Link href={`/u/${owner.username}/${repository.slug}`}>{owner.username}</Link> / {repository.name}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 0.4rem" }}>{repository.name}</h1>
            <p className="muted">{repository.description || "No description yet."}</p>
          </div>
          <div className="inline-actions repo-actions">
            <span className={repository.visibility === "public" ? "badge badge-public" : "badge"}>
              {repository.visibility === "public" ? "Public" : "Private"}
            </span>
            <a className="btn" href={`/api/repositories/${repository.id}/archive`}>Download</a>
            {view.role === "owner" ? <Link className="btn" href={`/u/${owner.username}/${repository.slug}/settings`}>Settings</Link> : null}
          </div>
        </div>
      </header>
      <FileBrowser
        repositoryId={repository.id}
        ownerId={owner.id}
        username={owner.username}
        slug={repository.slug}
        folderId={view.current?.id ?? null}
        canWrite={view.canWrite}
        maxUploadBytes={appConfig.maxUploadBytes}
        breadcrumbs={view.breadcrumbs}
        destinations={view.destinations}
        folders={view.childFolders.map((folder) => ({ id: folder.id, name: folder.name, updatedAt: folder.updated_at }))}
        files={view.files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mime_type,
          extension: file.extension,
          originalSize: file.original_size,
          updatedAt: file.updated_at,
        }))}
      />
      {view.readme && view.readmeText ? (
        <section style={{ marginTop: "1.2rem" }} className="card">
          <div style={{ padding: "1rem 1.1rem 0" }}><h2 style={{ margin: 0 }}>{view.readme.name}</h2></div>
          <div style={{ padding: "0.4rem 1.1rem 1.2rem" }}>
            <MarkdownView markdown={view.readmeText} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
