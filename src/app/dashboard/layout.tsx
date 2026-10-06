import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseBrowserEnv()) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  return <AppShell username={profile.username} displayName={profile.display_name}>{children}</AppShell>;
}
