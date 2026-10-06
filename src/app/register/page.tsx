import Link from "next/link";
import { RegisterForm } from "@/components/auth/auth-forms";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const profile = supabaseBrowserEnv() ? await getCurrentProfile() : null;
  return (
    <>
      <SiteHeader profile={profile} />
      <main className="shell auth-panel auth-panel-wide page-canvas">
        <h1>Create an account</h1>
        <RegisterForm />
        <p className="auth-switch">Already registered? <Link href="/login">Log in</Link></p>
      </main>
    </>
  );
}
