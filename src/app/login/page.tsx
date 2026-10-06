import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell auth-panel page-canvas">
        <h1>Log in</h1>
        <LoginForm next={safeNextPath(params.next)} />
        <p className="auth-switch">New here? <Link href="/register">Create an account</Link></p>
      </main>
    </>
  );
}
