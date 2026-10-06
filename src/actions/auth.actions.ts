"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { friendlyError, isNextRedirect, logServerError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils/format";
import type { ActionResult } from "@/types/action";

const usernamePattern = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  username: z.string().trim().toLowerCase().regex(usernamePattern),
  displayName: z.string().trim().min(1).max(80),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export async function registerAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check your email, username, display name, and password." };
  }

  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 5, 60 * 60))) {
    return { ok: false, error: "Too many attempts. Please wait and try again." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          username: parsed.data.username,
          display_name: parsed.data.displayName,
        },
        emailRedirectTo: `${appConfig.siteUrl}/auth/callback`,
      },
    });

    if (error) return { ok: false, error: friendlyError(error) };
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, error: "An account with that email already exists." };
    }
    if (!data.session) {
      const admin = createAdminClient();
      if (admin && data.user) {
        const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
        if (confirmError) logServerError("register-confirm", confirmError);
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) return { ok: false, error: friendlyError(signInError) };
    }
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    logServerError("register", error);
    return { ok: false, error: friendlyError(error) };
  }

  redirect("/dashboard");
}

export async function loginAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { ok: false, error: "Enter the email and password for your account." };

  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 15 * 60))) {
    return { ok: false, error: "Too many attempts. Please wait and try again." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return { ok: false, error: friendlyError(error) };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    logServerError("login", error);
    return { ok: false, error: friendlyError(error) };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function oauthAction(provider: "github" | "google"): Promise<ActionResult> {
  if (!appConfig.authProviders.includes(provider)) {
    return { ok: false, error: "That sign-in method is not enabled." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${appConfig.siteUrl}/auth/callback` },
  });

  if (error || !data.url) return { ok: false, error: "Unable to start that sign-in method." };
  redirect(data.url);
}
