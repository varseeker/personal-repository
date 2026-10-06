import Link from "next/link";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { PublicRepositoryCardView } from "@/components/repository/repository-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { RepositoryService } from "@/services/repository.service";

export const dynamic = "force-dynamic";

const sorts = [
  { id: "updated", label: "Recently updated" },
  { id: "created", label: "Recently created" },
  { id: "name", label: "Name" },
  { id: "size", label: "Storage size" },
];

export default async function PublicRepositoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  const query = params.q?.trim() ?? "";
  const sort = sorts.some((item) => item.id === params.sort) ? params.sort ?? "updated" : "updated";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const limit = 12;

  if (query && !(await rateLimit(`search:${await clientIp()}`, 60, 60))) {
    return (
      <>
        <SiteHeader profile={profile} />
        <main className="shell page-canvas catalog">
          <header className="catalog-head">
            <h1>Public repositories</h1>
            <p className="muted">Too many searches. Please wait and try again.</p>
          </header>
        </main>
      </>
    );
  }

  const result = supabaseBrowserEnv()
    ? await RepositoryService.searchPublic(await createClient(), {
        query,
        sort,
        limit,
        offset: (page - 1) * limit,
      }).catch(() => ({ items: [], total: 0 }))
    : { items: [], total: 0 };
  const pages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell page-canvas catalog">
        <header className="catalog-head">
          <p className="badge">Shared by their owners</p>
          <h1>Public repositories</h1>
          <p className="muted">Browse repositories that were published on purpose. Search by name, description, or username.</p>
        </header>
        <form className="card catalog-toolbar" action="/public-repositories">
          <label className="field">
            <span>Search</span>
            <span className="control">
              <Search className="control-icon control-icon-start" size={16} aria-hidden="true" />
              <input className="input" name="q" defaultValue={query} placeholder="Name, description, or username" />
            </span>
          </label>
          <label className="field">
            <span>Sort</span>
            <span className="select-shell">
              <select className="select" name="sort" defaultValue={sort}>
                {sorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </span>
          </label>
          <div className="field catalog-submit">
            <span aria-hidden="true">Search</span>
            <SubmitButton className="btn btn-primary" pendingLabel="Searching…">
              <Search size={16} aria-hidden="true" />
              Search
            </SubmitButton>
          </div>
        </form>
        <p className="muted catalog-meta">{result.total} {result.total === 1 ? "repository" : "repositories"}</p>
        {result.items.length === 0 ? <p className="empty-note">No public repositories found.</p> : (
          <div className="catalog-grid">
            {result.items.map((item) => <PublicRepositoryCardView key={item.id} item={item} />)}
          </div>
        )}
        <nav className="catalog-pager" aria-label="Pagination">
          {page > 1 ? <Link className="btn" href={pageHref(query, sort, page - 1)}>Previous</Link> : <span />}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn" href={pageHref(query, sort, page + 1)}>Next</Link> : <span />}
        </nav>
      </main>
    </>
  );
}

function pageHref(query: string, sort: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sort", sort);
  params.set("page", String(page));
  return `/public-repositories?${params.toString()}`;
}
