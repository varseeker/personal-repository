"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRepositoryAction, deleteRepositoryAction, setVisibilityAction, updateRepositoryAction } from "@/actions/repository.actions";
import { isNextRedirect } from "@/lib/errors";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import type { Repository } from "@/types/repository";

export function CreateRepositoryForm() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<string | null>(null);

  return (
    <div className="create-repo">
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Create repository</button>
      {open ? (
        <Modal onClose={() => setOpen(false)}>
          <form action={async (formData) => {
            try {
              const result = await createRepositoryAction(null, formData);
              if (result && !result.ok) setState(result.error);
            } catch (error) {
              if (isNextRedirect(error)) throw error;
              setState("Unable to create the repository.");
            }
          }}>
            <h2>Create repository</h2>
            <p className="muted">New repositories are private until you explicitly make them public.</p>
            <label className="field"><span>Name</span><input className="input" name="name" required /></label>
            <label className="field"><span>Description</span><textarea className="textarea" name="description" /></label>
            {state ? <p className="form-error">{state}</p> : null}
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <SubmitButton className="btn btn-primary" pendingLabel="Creating…">Create</SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function RepositorySettingsForm({ repository }: { repository: Repository }) {
  const toast = useToast();
  const router = useRouter();
  const [visibility, setVisibility] = useState(repository.visibility);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState<"visibility" | "public" | "delete" | null>(null);

  return (
    <div className="stack">
      <form className="card form-card" action={async (formData) => {
        const result = await updateRepositoryAction(repository.id, formData);
        if (!result.ok) toast(result.error, "error");
        else {
          toast("Repository updated.");
          router.refresh();
        }
      }}>
        <h2>General</h2>
        <label className="field"><span>Name</span><input className="input" name="name" defaultValue={repository.name} required /></label>
        <label className="field"><span>Description</span><textarea className="textarea" name="description" defaultValue={repository.description ?? ""} /></label>
        <SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save</SubmitButton>
      </form>

      <section className="card panel">
        <h2>Visibility</h2>
        <div className="inline-actions">
          <label><input type="radio" name="visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} /> Private</label>
          <label><input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Public</label>
        </div>
        <div style={{ marginTop: "0.8rem" }}>
          <button className="btn" type="button" disabled={working !== null} aria-busy={working === "visibility" || undefined} onClick={() => {
            if (visibility === "public" && repository.visibility !== "public") setConfirmPublic(true);
            else {
              setWorking("visibility");
              void setVisibilityAction(repository.id, visibility, true).then((result) => {
                setWorking(null);
                if (!result.ok) toast(result.error, "error");
                else {
                  toast("Visibility updated.");
                  router.refresh();
                }
              });
            }
          }}>{working === "visibility" ? "Saving…" : "Save visibility"}</button>
        </div>
      </section>

      {confirmPublic ? (
        <Modal onClose={() => { if (!working) setConfirmPublic(false); }}>
          <h2>Make this repository public?</h2>
          <p>Anyone on the internet will be able to view and download files in this repository.</p>
          <div className="inline-actions">
            <button className="btn" type="button" onClick={() => setConfirmPublic(false)}>Cancel</button>
            <button className="btn btn-primary" type="button" disabled={working !== null} aria-busy={working === "public" || undefined} onClick={() => {
              setWorking("public");
              void setVisibilityAction(repository.id, "public", true).then((result) => {
                setWorking(null);
                setConfirmPublic(false);
                if (!result.ok) toast(result.error, "error");
                else {
                  toast("Repository is now public.");
                  router.refresh();
                }
              });
            }}>{working === "public" ? "Saving…" : "Make public"}</button>
          </div>
        </Modal>
      ) : null}

      <section className="card form-card">
        <h2>Danger zone</h2>
        <p>Delete this repository and every file inside it. This cannot be undone.</p>
        <label className="field">Type “{repository.name}” to confirm
          <input className="input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <button className="btn btn-danger" type="button" disabled={working !== null} aria-busy={working === "delete" || undefined} onClick={() => {
          setWorking("delete");
          void deleteRepositoryAction(repository.id, confirmation).then((result) => {
            setWorking(null);
            if (result && !result.ok) toast(result.error, "error");
          });
        }}>{working === "delete" ? "Deleting…" : "Delete repository"}</button>
      </section>
    </div>
  );
}
