import Link from "next/link";
import { formatBytes, formatDate } from "@/lib/utils/format";
import type { PublicRepositoryCard, Repository } from "@/types/repository";

export function RepositoryCard({
  repository,
  username,
  stats,
}: {
  repository: Repository;
  username: string;
  stats?: { files: number; folders: number; storedBytes: number };
}) {
  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <h3 style={{ margin: "0 0 0.35rem" }}>
          <Link href={`/u/${username}/${repository.slug}`}>{repository.name}</Link>
        </h3>
        <span className={repository.visibility === "public" ? "badge badge-public" : "badge"}>
          {repository.visibility === "public" ? "Public" : "Private"}
        </span>
      </div>
      <p className="muted" style={{ minHeight: "2.6rem" }}>{repository.description || "No description yet."}</p>
      <p className="muted" style={{ marginBottom: 0 }}>
        {stats ? `${stats.files} files · ${stats.folders} folders · ${formatBytes(stats.storedBytes)} · ` : null}
        Updated {formatDate(repository.updated_at)}
      </p>
    </article>
  );
}

export function PublicRepositoryCardView({ item }: { item: PublicRepositoryCard }) {
  return (
    <article className="card">
      <h3 style={{ margin: "0 0 0.25rem" }}>
        <Link href={`/u/${item.owner_username}/${item.slug}`}>{item.name}</Link>
      </h3>
      <p className="muted" style={{ marginTop: 0 }}>by {item.owner_display_name} · @{item.owner_username}</p>
      <p>{item.description || "No description yet."}</p>
      <p className="muted" style={{ marginBottom: 0 }}>
        {item.file_count} files · {item.folder_count} folders · {formatBytes(item.stored_bytes)}
        {item.has_readme ? " · README" : ""}
        <br />
        Updated {formatDate(item.updated_at)} · Created {formatDate(item.created_at)}
      </p>
    </article>
  );
}
