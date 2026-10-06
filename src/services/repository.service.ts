import "server-only";
import { AppError } from "@/lib/errors";
import { mapPublicRepository, mapRepository, mapRows, mapSearchHit } from "@/lib/mappers";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import type { PublicRepositoryCard, Repository, SearchHit, Visibility } from "@/types/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

const REPOSITORY_COLUMNS = "id, owner_id, name, slug, description, visibility, storage_limit_bytes, created_at, updated_at";

export const RepositoryService = {
  async listMine(supabase: SupabaseClient, ownerId: string, visibility?: Visibility): Promise<Repository[]> {
    let query = supabase
      .from("repositories")
      .select(REPOSITORY_COLUMNS)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });

    if (visibility) query = query.eq("visibility", visibility);
    const { data, error } = await query;
    if (error) throw new AppError("Unable to load repositories.");
    return mapRows(data, mapRepository);
  },

  async getBySlug(supabase: SupabaseClient, ownerId: string, slug: string): Promise<Repository | null> {
    const { data, error } = await supabase
      .from("repositories")
      .select(REPOSITORY_COLUMNS)
      .eq("owner_id", ownerId)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new AppError("Unable to load that repository.");
    return mapRepository(data);
  },

  async getById(supabase: SupabaseClient, repositoryId: string): Promise<Repository | null> {
    const { data, error } = await supabase
      .from("repositories")
      .select(REPOSITORY_COLUMNS)
      .eq("id", repositoryId)
      .maybeSingle();

    if (error) throw new AppError("Unable to load that repository.");
    return mapRepository(data);
  },

  async create(
    supabase: SupabaseClient,
    ownerId: string,
    input: { name: string; description: string },
  ): Promise<Repository> {
    const base = slugify(input.name);
    if (!base) throw new AppError("Use a repository name that contains letters or numbers.");

    const existing = await this.listMine(supabase, ownerId);
    const slug = uniqueSlug(base, new Set(existing.map((repository) => repository.slug)));

    const { data, error } = await supabase
      .from("repositories")
      .insert({
        owner_id: ownerId,
        name: input.name.trim(),
        slug,
        description: input.description.trim() || null,
        visibility: "private",
      })
      .select(REPOSITORY_COLUMNS)
      .single();

    if (error || !data) throw error ?? new AppError("Unable to create the repository.");
    const repository = mapRepository(data);
    if (!repository) throw new AppError("Unable to create the repository.");
    return repository;
  },

  async update(
    supabase: SupabaseClient,
    repositoryId: string,
    input: { name: string; description: string },
  ): Promise<void> {
    const { error } = await supabase
      .from("repositories")
      .update({
        name: input.name.trim(),
        description: input.description.trim() || null,
      })
      .eq("id", repositoryId);

    if (error) throw error;
  },

  async setVisibility(supabase: SupabaseClient, repositoryId: string, visibility: Visibility): Promise<void> {
    const { error } = await supabase.from("repositories").update({ visibility }).eq("id", repositoryId);
    if (error) throw error;
  },

  async delete(supabase: SupabaseClient, repositoryId: string): Promise<string[]> {
    const { data, error: listError } = await supabase
      .from("files")
      .select("storage_path")
      .eq("repository_id", repositoryId);

    if (listError) throw new AppError("Unable to delete the repository.");
    const paths = mapRows(data, (row) => {
      if (typeof row !== "object" || row === null || !("storage_path" in row)) return null;
      return typeof row.storage_path === "string" ? row.storage_path : null;
    });

    const { error } = await supabase.from("repositories").delete().eq("id", repositoryId);
    if (error) throw error;
    return paths;
  },

  async searchPublic(
    supabase: SupabaseClient,
    input: { query: string; sort: string; limit: number; offset: number },
  ): Promise<{ items: PublicRepositoryCard[]; total: number }> {
    const { data, error } = await supabase.rpc("search_public_repositories", {
      p_query: input.query,
      p_sort: input.sort,
      p_limit: input.limit,
      p_offset: input.offset,
    });

    if (error) throw new AppError("Unable to search public repositories.");
    const items = mapRows(data, mapPublicRepository);
    const first = items[0];
    const totalRow = Array.isArray(data) ? data[0] : null;
    const total = first && totalRow && typeof totalRow === "object" && totalRow !== null && "total_count" in totalRow
      ? Number(totalRow.total_count)
      : items.length;
    return { items, total: Number.isFinite(total) ? total : items.length };
  },

  async searchMine(supabase: SupabaseClient, query: string): Promise<SearchHit[]> {
    const { data, error } = await supabase.rpc("search_my_items", { p_query: query });
    if (error) throw new AppError("Unable to search your repositories.");
    return mapRows(data, mapSearchHit);
  },

  async storedSize(supabase: SupabaseClient, repositoryId: string): Promise<number> {
    const { data, error } = await supabase.from("files").select("stored_size").eq("repository_id", repositoryId);
    if (error || !Array.isArray(data)) return 0;
    return data.reduce((sum, row) => {
      if (typeof row !== "object" || row === null || !("stored_size" in row)) return sum;
      return sum + Number(row.stored_size);
    }, 0);
  },
};
