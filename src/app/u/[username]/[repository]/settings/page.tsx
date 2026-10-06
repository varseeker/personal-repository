import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { RepositorySettingsForm } from "@/components/repository/repository-forms";
import { getCurrentProfile } from "@/lib/auth/session";
import { loadRepositoryView } from "@/lib/data/repository-view";
import { formatBytes } from "@/lib/utils/format";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { RepositoryService } from "@/services/repository.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Repository settings", robots: { index: false, follow: false } };

export default async function RepositorySettingsPage({
  params,
}: {
  params: Promise<{ username: string; repository: string }>;
}) {
  const { username, repository: slug } = await params;
  const view = await loadRepositoryView(username, slug, []);
  if (!view.configured || view.missing) notFound();
  if (view.role !== "owner") redirect(`/u/${view.owner.username}/${view.repository.slug}`);
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  const used = await RepositoryService.storedSize(await createClient(), view.repository.id);
  const ratio = view.repository.storage_limit_bytes > 0 ? Math.min(100, (used / view.repository.storage_limit_bytes) * 100) : 0;

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell" style={{ paddingBottom: "3rem" }}>
        <h1>{view.repository.name} settings</h1>
        <section className="card quota" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <h2>Storage</h2>
          <div className="progress" role="meter" aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${ratio}%` }} />
          </div>
          <p className="muted">{formatBytes(used)} used · {formatBytes(view.repository.storage_limit_bytes)} repository limit</p>
        </section>
        <RepositorySettingsForm repository={view.repository} />
      </main>
    </>
  );
}
