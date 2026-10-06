import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/config";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { RepositoryService } from "@/services/repository.service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appConfig.siteUrl;
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/public-repositories`, changeFrequency: "daily", priority: 0.8 },
  ];

  if (!supabaseBrowserEnv()) return entries;

  try {
    const result = await RepositoryService.searchPublic(await createClient(), {
      query: "",
      sort: "updated",
      limit: 24,
      offset: 0,
    });
    for (const item of result.items) {
      entries.push({
        url: `${base}/u/${item.owner_username}/${item.slug}`,
        lastModified: item.updated_at,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    return entries;
  }

  return entries;
}
