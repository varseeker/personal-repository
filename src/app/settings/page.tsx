import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!supabaseBrowserEnv()) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/settings");

  return (
    <AppShell username={profile.username} displayName={profile.display_name}>
      <h1>Settings</h1>
      <ProfileForm profile={profile} />
    </AppShell>
  );
}
