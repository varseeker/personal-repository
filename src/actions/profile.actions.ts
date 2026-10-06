"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { friendlyError, logServerError } from "@/lib/errors";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/services/user.service";
import type { ActionResult } from "@/types/action";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/),
  bio: z.string().trim().max(500),
});

export async function updateProfileAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    bio: formData.get("bio") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Check your display name, username, and bio." };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createClient();
    await UserService.update(supabase, profile.id, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logServerError("update-profile", error);
    return { ok: false, error: friendlyError(error) };
  }
}

export async function updateAvatarAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Avatar images must be 2 MB or smaller." };

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return { ok: false, error: "Use a PNG, JPG, WEBP, or GIF image." };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createClient();
    const path = UserService.avatarObjectPath(profile.id);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(appConfig.avatarsBucket).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (error) return { ok: false, error: "Unable to upload that image." };

    const url = UserService.publicAvatarUrl(profile.id);
    if (!url) return { ok: false, error: "Unable to save that image." };
    await UserService.setAvatarUrl(supabase, profile.id, `${url}?v=${Date.now()}`);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    logServerError("update-avatar", error);
    return { ok: false, error: friendlyError(error) };
  }
}
