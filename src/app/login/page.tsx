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
      <main className="shell" style={{ maxWidth: 460, paddingBottom: "3rem" }}>
        <h1>Log in</h1>
        <p className="muted">Email and password are supported now. OAuth can be enabled later from Supabase.</p>
        <LoginForm next={safeNextPath(params.next)} />
        <p>New here? <Link href="/register">Create an account</Link></p>
      </main>
    </>
  );
}
