"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replaceTextAction } from "@/actions/file.actions";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { useToast } from "@/components/ui/toast";

export function TextEditor({
  repositoryId,
  fileId,
  initial,
  markdown,
}: {
  repositoryId: string;
  fileId: string;
  initial: string;
  markdown: boolean;
}) {
  const [mode, setMode] = useState<"preview" | "edit" | "raw">(markdown ? "preview" : "raw");
  const [content, setContent] = useState(initial);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    setPending(true);
    const result = await replaceTextAction(repositoryId, fileId, content);
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("File saved.");
    router.refresh();
  }

  return (
    <section className="card" style={{ padding: "1rem" }}>
      <div className="inline-actions" style={{ marginBottom: "0.8rem" }}>
        {markdown ? <button type="button" className="btn" onClick={() => setMode("preview")}>Preview</button> : null}
        <button type="button" className="btn" onClick={() => setMode("edit")}>Edit</button>
        <button type="button" className="btn" onClick={() => setMode("raw")}>Raw</button>
        {mode === "edit" ? <button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending || undefined} onClick={() => void save()}>{pending ? "Saving…" : "Save"}</button> : null}
      </div>
      {mode === "preview" && markdown ? <MarkdownView markdown={content} /> : null}
      {mode === "edit" ? (
        <label className="field">
          File contents
          <textarea className="textarea" style={{ minHeight: "24rem" }} value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
      ) : null}
      {mode === "raw" ? <pre className="code-fallback"><code>{content}</code></pre> : null}
    </section>
  );
}
