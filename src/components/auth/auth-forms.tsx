"use client";

import { useActionState } from "react";
import { loginAction, oauthAction, registerAction } from "@/actions/auth.actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { appConfig } from "@/lib/config";
import type { ActionResult } from "@/types/action";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <form action={action} className="card form-card">
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        {state && !state.ok ? <p className="form-error">{state.error}</p> : null}
        <SubmitButton className="btn btn-primary" pendingLabel="Logging in…">Log in</SubmitButton>
      </form>
      <OAuthButtons />
    </div>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <form action={action} className="card form-card">
        <label className="field"><span>Display name</span><input className="input" name="displayName" required /></label>
        <label className="field"><span>Username</span><input className="input" name="username" required minLength={3} /></label>
        <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        {state && !state.ok ? <p className="form-error">{state.error}</p> : null}
        <SubmitButton className="btn btn-primary" pendingLabel="Creating account…">Create account</SubmitButton>
      </form>
      <OAuthButtons />
    </div>
  );
}

function OAuthButtons() {
  if (appConfig.authProviders.length === 0) return null;
  return (
    <div className="inline-actions">
      {appConfig.authProviders.map((provider) => (
        <button key={provider} className="btn" type="button" onClick={() => void oauthAction(provider)}>
          Continue with {provider}
        </button>
      ))}
    </div>
  );
}

export type { ActionResult };
