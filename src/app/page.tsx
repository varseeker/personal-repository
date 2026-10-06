import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { PublicRepositoryCardView } from "@/components/repository/repository-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { RepositoryService } from "@/services/repository.service";

export const dynamic = "force-dynamic";

const features = [
  ["Personal repositories", "Keep documents, projects, and backups in separate repositories."],
  ["Private or public", "Repositories stay private until you explicitly publish them."],
  ["Folders", "Nest folders the same way you would on your computer."],
  ["Upload and download", "Store common documents, media, archives, and source files."],
  ["Markdown", "Read README files and Markdown notes in the repository."],
  ["Previews", "Open images, PDF, text, and source files without downloading first."],
  ["Storage optimization", "Text and source files are gzip-compressed only when that saves space."],
  ["Signed-in ownership", "Row level security keeps private repositories with their owner."],
  ["Shareable links", "Public repositories have a stable username and slug URL."],
];

export default async function HomePage() {
  const configured = Boolean(supabaseBrowserEnv());
  const profile = configured ? await getCurrentProfile() : null;
  const preview = configured
    ? await RepositoryService.searchPublic(await createClient(), { query: "", sort: "updated", limit: 4, offset: 0 }).catch(() => ({ items: [], total: 0 }))
    : { items: [], total: 0 };

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell page-canvas">
        <section className="hero">
          <div>
            <p className="badge">Cloud storage for people who think in repositories</p>
            <h1>Your files. Your repositories. Your control.</h1>
            <p className="lede">A personal cloud repository for storing, organizing, and sharing files. Private by default, public when you say so.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={profile ? "/dashboard" : "/register"}>Get started</Link>
              <Link className="btn" href="/public-repositories">Explore public repositories</Link>
            </div>
          </div>
          <aside className="card" style={{ padding: "1.1rem" }} aria-hidden="true">
            <p className="muted">My Repository</p>
            <pre style={{ margin: 0, lineHeight: 1.7 }}>{`README.md
src/
  components/
  hooks/
docs/
assets/`}</pre>
          </aside>
        </section>
        <section className="feature-grid">
          {features.map(([title, copy]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p className="muted">{copy}</p>
            </article>
          ))}
        </section>
        <section>
          <h2>How it works</h2>
          <div className="steps">
            <span>Create repository</span>
            <span>Upload files</span>
            <span>Organize</span>
            <span>Choose private or public</span>
            <span>Share</span>
          </div>
        </section>
        <section className="public-preview">
          <div className="section-heading">
            <h2>Public repositories</h2>
            <Link className="text-link" href="/public-repositories">View all</Link>
          </div>
          {preview.items.length === 0 ? <p className="empty-note">No public repositories yet.</p> : (
            <div className="repo-grid">
              {preview.items.map((item) => <PublicRepositoryCardView key={item.id} item={item} />)}
            </div>
          )}
        </section>
        <section className="card cta-band">
          <h2>Start building your repository today.</h2>
          <Link className="btn btn-primary" href="/register">Create account</Link>
        </section>
      </main>
    </>
  );
}
