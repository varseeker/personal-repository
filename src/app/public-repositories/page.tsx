import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
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
        <main className="shell"><h1>Public repositories</h1><p>Too many searches. Please wait and try again.</p></main>
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
      <main className="shell" style={{ paddingBottom: "3rem" }}>
        <h1>Public repositories</h1>
        <form className="inline-actions" action="/public-repositories">
          <label className="field" style={{ flex: 1 }}>
            Search
            <input className="input" name="q" defaultValue={query} placeholder="Name, description, or username" />
          </label>
          <label className="field">
            Sort
            <select className="select" name="sort" defaultValue={sort}>
              {sorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        {result.items.length === 0 ? <p className="muted">No public repositories found.</p> : (
          <div className="repo-grid" style={{ marginTop: "1rem" }}>
            {result.items.map((item) => <PublicRepositoryCardView key={item.id} item={item} />)}
          </div>
        )}
        <nav className="inline-actions" aria-label="Pagination" style={{ marginTop: "1rem" }}>
          {page > 1 ? <Link className="btn" href={pageHref(query, sort, page - 1)}>Previous</Link> : null}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn" href={pageHref(query, sort, page + 1)}>Next</Link> : null}
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
