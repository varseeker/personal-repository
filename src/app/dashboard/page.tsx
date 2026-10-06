import Link from "next/link";
import { CreateRepositoryForm } from "@/components/repository/repository-forms";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { ActivityService } from "@/services/activity.service";
import { RepositoryService } from "@/services/repository.service";
import { UserService } from "@/services/user.service";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const params = await searchParams;
  const supabase = await createClient();
  const query = params.q?.trim() ?? "";
  const [repositories, used, activity, fileCount, hits] = await Promise.all([
    RepositoryService.listMine(supabase, profile.id),
    UserService.storageUsed(supabase, profile.id),
    ActivityService.recent(supabase),
    supabase.from("files").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    query.length >= 2 ? RepositoryService.searchMine(supabase, query) : Promise.resolve([]),
  ]);
  const ratio = profile.storage_limit_bytes > 0 ? Math.min(100, (used / profile.storage_limit_bytes) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: "0.2rem" }}>Welcome back, {profile.display_name}</h1>
          <p className="muted">@{profile.username}</p>
        </div>
        <CreateRepositoryForm />
      </div>
      <form action="/dashboard">
        <label className="field">Search your repositories, folders, and files
          <input className="input" name="q" defaultValue={query} placeholder="At least 2 characters" />
        </label>
      </form>
      {query.length >= 2 ? (
        <section className="card" style={{ padding: "0.4rem 1rem 1rem" }}>
          <h2>Search results</h2>
          {hits.length === 0 ? <p className="muted">No matches in your repositories.</p> : hits.map((hit) => (
            <p key={`${hit.kind}-${hit.item_id}`}>
              <Link href={hit.kind === "repository"
                ? `/u/${hit.owner_username}/${hit.repository_slug}`
                : `/u/${hit.owner_username}/${hit.repository_slug}`}>{hit.name}</Link>
              <span className="muted"> · {hit.kind} · {hit.repository_name}</span>
            </p>
          ))}
        </section>
      ) : null}
      <section className="stat-grid">
        <article className="card"><strong>{repositories.length}</strong><div className="muted">Repositories</div></article>
        <article className="card"><strong>{fileCount.count ?? 0}</strong><div className="muted">Files</div></article>
        <article className="card"><strong>{formatBytes(used)}</strong><div className="muted">Stored</div></article>
        <article className="card"><strong>{repositories.filter((item) => item.visibility === "public").length}</strong><div className="muted">Public</div></article>
      </section>
      <section className="card quota" style={{ padding: "1rem" }}>
        <strong>Your storage</strong>
        <div className="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio)} role="meter">
          <span style={{ width: `${ratio}%` }} />
        </div>
        <span className="muted">{formatBytes(used)} / {formatBytes(profile.storage_limit_bytes)}</span>
      </section>
      <section>
        <h2>Repositories</h2>
        {repositories.length === 0 ? (
          <div className="card" style={{ padding: "1.2rem" }}>
            <h3>No repositories yet.</h3>
            <p className="muted">Create your first repository to start organizing your files.</p>
            <CreateRepositoryForm />
          </div>
        ) : (
          <div className="repo-grid">
            {repositories.slice(0, 6).map((repository) => (
              <article className="card" key={repository.id}>
                <h3 style={{ marginTop: 0 }}><Link href={`/u/${profile.username}/${repository.slug}`}>{repository.name}</Link></h3>
                <p className="muted">{repository.visibility} · Updated {formatDate(repository.updated_at)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="card" style={{ padding: "1rem" }}>
        <h2>Recent activity</h2>
        {activity.length === 0 ? <p className="muted">Activity will appear after you create repositories and upload files.</p> : activity.map((event) => (
          <p key={event.id} className="muted">{event.event_type.replaceAll("_", " ")}{event.metadata.name ? ` · ${event.metadata.name}` : ""} · {formatDate(event.created_at)}</p>
        ))}
      </section>
    </div>
  );
}
