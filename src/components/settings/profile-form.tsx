"use client";

import { useActionState } from "react";
import { updateAvatarAction, updateProfileAction } from "@/actions/profile.actions";
import type { Profile } from "@/types/user";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [avatarState, avatarAction, avatarPending] = useActionState(
    async (_state: { ok: boolean; error?: string } | null, formData: FormData) => updateAvatarAction(formData),
    null,
  );

  return (
    <div className="stack">
      <form action={action} className="card form-card">
        <h2>Profile</h2>
        <label className="field"><span>Display name</span><input className="input" name="displayName" defaultValue={profile.display_name} required /></label>
        <label className="field"><span>Username</span><input className="input" name="username" defaultValue={profile.username} required /></label>
        <label className="field"><span>Bio</span><textarea className="textarea" name="bio" defaultValue={profile.bio ?? ""} maxLength={500} /></label>
        {state && !state.ok ? <p className="form-error">{state.error}</p> : null}
        {state?.ok ? <p>Profile saved.</p> : null}
        <button className="btn btn-primary" disabled={pending} type="submit">Save profile</button>
      </form>
      <form action={avatarAction} className="card form-card">
        <h2>Avatar</h2>
        {profile.avatar_url ? <img src={profile.avatar_url} alt="" width={72} height={72} style={{ borderRadius: "50%", objectFit: "cover" }} /> : null}
        <label className="field"><span>Image</span><input className="input" name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required /></label>
        {avatarState && !avatarState.ok ? <p className="form-error">{avatarState.error}</p> : null}
        <button className="btn" disabled={avatarPending} type="submit">Upload avatar</button>
      </form>
    </div>
  );
}
