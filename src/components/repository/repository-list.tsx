import { CreateRepositoryForm } from "@/components/repository/repository-forms";
import { RepositoryCard } from "@/components/repository/repository-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RepositoryService } from "@/services/repository.service";
import type { Visibility } from "@/types/repository";

export async function RepositoryList({ title, visibility }: { title: string; visibility?: Visibility }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const repositories = await RepositoryService.listMine(await createClient(), profile.id, visibility);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h1>{title}</h1>
        <CreateRepositoryForm />
      </div>
      {repositories.length === 0 ? (
        <div className="card" style={{ padding: "1.2rem" }}>
          <h2>No repositories yet.</h2>
          <p className="muted">Create your first repository to start organizing your files.</p>
        </div>
      ) : (
        <div className="repo-grid">
          {repositories.map((repository) => (
            <RepositoryCard key={repository.id} repository={repository} username={profile.username} />
          ))}
        </div>
      )}
    </div>
  );
}
