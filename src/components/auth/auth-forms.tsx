"use client";

import { useActionState } from "react";
import { loginAction, oauthAction, registerAction } from "@/actions/auth.actions";
import { appConfig } from "@/lib/config";
import type { ActionResult } from "@/types/action";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <form action={action} className="card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
        <input type="hidden" name="next" value={next} />
        <label className="field">Email<input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field">Password<input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        {state && !state.ok ? <p className="form-error">{state.error}</p> : null}
        <button className="btn btn-primary" disabled={pending} type="submit">Log in</button>
      </form>
      <OAuthButtons />
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);
  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <form action={action} className="card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
        <label className="field">Display name<input className="input" name="displayName" required /></label>
        <label className="field">Username<input className="input" name="username" required minLength={3} /></label>
        <label className="field">Email<input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field">Password<input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        {state && !state.ok ? <p className="form-error">{state.error}</p> : null}
        {state?.ok ? <p>Check your email to confirm the account, then log in.</p> : null}
        <button className="btn btn-primary" disabled={pending} type="submit">Create account</button>
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
