import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { RepositoryScreen } from "@/components/repository/repository-screen";
import { getCurrentProfile } from "@/lib/auth/session";
import { loadRepositoryView } from "@/lib/data/repository-view";
import { appConfig } from "@/lib/config";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Params = { username: string; repository: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, repository } = await params;
  const view = await loadRepositoryView(username, repository, []);
  if (!view.configured || view.missing) return { title: "Repository", robots: { index: false, follow: false } };
  const title = `${view.repository.name} — Repository by ${view.owner.username}`;
  const index = view.repository.visibility === "public";
  return {
    title,
    description: view.repository.description || `Files shared by ${view.owner.username}.`,
    robots: { index, follow: index },
    alternates: { canonical: `${appConfig.siteUrl}/u/${view.owner.username}/${view.repository.slug}` },
    openGraph: index ? {
      title,
      description: view.repository.description || undefined,
      url: `${appConfig.siteUrl}/u/${view.owner.username}/${view.repository.slug}`,
    } : undefined,
  };
}

export default async function RepositoryPage({ params }: { params: Promise<Params> }) {
  const { username, repository } = await params;
  const view = await loadRepositoryView(username, repository, []);
  if (!view.configured) return <main className="shell"><p>Configure Supabase to open repositories.</p></main>;
  if (view.missing) notFound();
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  return (
    <>
      <SiteHeader profile={profile} />
      <RepositoryScreen view={view} />
    </>
  );
}
