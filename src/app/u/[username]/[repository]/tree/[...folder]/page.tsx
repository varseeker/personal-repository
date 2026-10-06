import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { RepositoryScreen } from "@/components/repository/repository-screen";
import { getCurrentProfile } from "@/lib/auth/session";
import { loadRepositoryView } from "@/lib/data/repository-view";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Params = { username: string; repository: string; folder: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, repository, folder } = await params;
  const view = await loadRepositoryView(username, repository, folder);
  const index = view.configured && !view.missing && view.repository.visibility === "public";
  return { title: view.configured && !view.missing ? view.current?.name ?? "Folder" : "Folder", robots: { index, follow: index } };
}

export default async function FolderPage({ params }: { params: Promise<Params> }) {
  const { username, repository, folder } = await params;
  const view = await loadRepositoryView(username, repository, folder);
  if (!view.configured || view.missing) notFound();
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  return (
    <>
      <SiteHeader profile={profile} />
      <RepositoryScreen view={view} />
    </>
  );
}
