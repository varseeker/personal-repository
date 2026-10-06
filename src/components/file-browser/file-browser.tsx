"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Archive,
  Download,
  Ellipsis,
  File as FileIcon,
  FileCode,
  FileText,
  Film,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  Music,
  Sheet,
  Upload,
} from "lucide-react";
import {
  createFolderAction,
  deleteFolderAction,
  ensureFolderPathAction,
  moveFolderAction,
  renameFolderAction,
} from "@/actions/folder.actions";
import {
  commitFileAction,
  createTextFileAction,
  deleteFileAction,
  moveFileAction,
  prepareUploadAction,
  renameFileAction,
} from "@/actions/file.actions";
import { useToast } from "@/components/ui/toast";
import { compressionSavingsRatio, shouldCompress } from "@/lib/compression/should-compress";
import { createClient } from "@/lib/supabase/client";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import { fileExtension, nextDuplicateName, sanitizeFilename } from "@/lib/utils/filename";
import { fileKind, type FileKind } from "@/lib/utils/file-kind";
import { formatBytes, formatDate } from "@/lib/utils/format";

export type BrowserFolder = { id: string; name: string; updatedAt: string };
export type BrowserFile = {
  id: string;
  name: string;
  mimeType: string;
  extension: string | null;
  originalSize: number;
  updatedAt: string;
};
type QueueItem = { id: string; name: string; progress: number; status: "queued" | "uploading" | "done" | "error"; message?: string };
type Target = { kind: "file" | "folder"; id: string; name: string };
type DuplicateChoice = "replace" | "keep" | "cancel";

function KindIcon({ kind }: { kind: FileKind | "folder" }) {
  const props = { size: 16, "aria-hidden": true as const };
  if (kind === "folder") return <Folder {...props} />;
  if (kind === "image") return <ImageIcon {...props} />;
  if (kind === "video") return <Film {...props} />;
  if (kind === "audio") return <Music {...props} />;
  if (kind === "archive") return <Archive {...props} />;
  if (kind === "code") return <FileCode {...props} />;
  if (kind === "markdown" || kind === "text" || kind === "document") return <FileText {...props} />;
  if (kind === "spreadsheet") return <Sheet {...props} />;
  return <FileIcon {...props} />;
}

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function maybeGzip(file: File): Promise<{ blob: Blob; compressionType: "gzip" | null }> {
  const extension = fileExtension(file.name);
  if (!shouldCompress({ mimeType: file.type || "application/octet-stream", extension, size: file.size })) {
    return { blob: file, compressionType: null };
  }
  if (typeof CompressionStream === "undefined") return { blob: file, compressionType: null };
  const compressed = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  if (compressed.size < file.size * compressionSavingsRatio) return { blob: compressed, compressionType: "gzip" };
  return { blob: file, compressionType: null };
}

export function FileBrowser({
  repositoryId,
  ownerId,
  username,
  slug,
  folderId,
  canWrite,
  files,
  folders,
  destinations,
  breadcrumbs,
  maxUploadBytes,
}: {
  repositoryId: string;
  ownerId: string;
  username: string;
  slug: string;
  folderId: string | null;
  canWrite: boolean;
  files: BrowserFile[];
  folders: BrowserFolder[];
  destinations: { id: string | null; label: string }[];
  breadcrumbs: { label: string; href: string }[];
  maxUploadBytes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<"folder" | "file" | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<"rename" | "delete" | "move" | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; choose: (choice: DuplicateChoice) => void } | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function uploadOne(file: File, targetFolderId: string | null, relativeName?: string) {
    const safeName = sanitizeFilename(relativeName ?? file.name);
    if (!safeName) {
      toast("That file name is not allowed.", "error");
      return;
    }
    if (file.size > maxUploadBytes) {
      toast(`${safeName} is larger than the upload limit.`, "error");
      return;
    }

    const existing = files.find((item) => item.name.toLowerCase() === safeName.toLowerCase() && targetFolderId === folderId);
    let finalName = safeName;
    let replaceId: string | null = null;
    if (existing && targetFolderId === folderId) {
      const choice = await new Promise<DuplicateChoice>((choose) => setDuplicate({ name: existing.name, choose }));
      setDuplicate(null);
      if (choice === "cancel") return;
      if (choice === "replace") replaceId = existing.id;
      if (choice === "keep") {
        finalName = nextDuplicateName(safeName, new Set(files.map((item) => item.name.toLowerCase())));
      }
    }

    const id = crypto.randomUUID();
    setQueue((current) => [...current, { id, name: finalName, progress: 5, status: "uploading" }]);
    const prepared = await prepareUploadAction({ repositoryId, incomingBytes: file.size });
    if (!prepared.ok) {
      setQueue((current) => current.map((item) => item.id === id ? { ...item, status: "error", message: prepared.error } : item));
      toast(prepared.error, "error");
      return;
    }

    const env = supabaseBrowserEnv();
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!env || !token) {
      toast("You need to sign in again.", "error");
      return;
    }

    const { blob, compressionType } = await maybeGzip(file);
    const checksum = await sha256(file);
    const fileId = replaceId ?? crypto.randomUUID();
    const storagePath = `${ownerId}/${repositoryId}/${fileId}`;
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", new File([blob], "object", { type: compressionType ? "application/gzip" : file.type || "application/octet-stream" }));

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
      xhr.open("POST", `${env.url}/storage/v1/object/repository-files/${encoded}`);
      xhr.setRequestHeader("authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", env.anonKey);
      xhr.setRequestHeader("x-upsert", replaceId ? "true" : "false");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.max(8, Math.round((event.loaded / event.total) * 90));
        setQueue((current) => current.map((item) => item.id === id ? { ...item, progress } : item));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    }).catch(() => {
      setQueue((current) => current.map((item) => item.id === id ? { ...item, status: "error", message: "Upload failed" } : item));
      toast(`Unable to upload ${finalName}.`, "error");
      throw new Error("upload");
    });

    const saved = await commitFileAction({
      repositoryId,
      folderId: targetFolderId,
      name: finalName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      originalSize: file.size,
      checksum,
      compressionType,
      fileId,
      replaceFileId: replaceId,
    });

    if (!saved.ok) {
      setQueue((current) => current.map((item) => item.id === id ? { ...item, status: "error", message: saved.error } : item));
      toast(saved.error, "error");
      return;
    }

    setQueue((current) => current.map((item) => item.id === id ? { ...item, progress: 100, status: "done" } : item));
  }

  async function uploadList(list: { file: File; relativePath: string }[]) {
    const groups = new Map<string, File[]>();
    for (const item of list) {
      const parts = item.relativePath.split("/");
      const directory = parts.slice(0, -1).join("/");
      const bucket = groups.get(directory) ?? [];
      bucket.push(item.file);
      groups.set(directory, bucket);
    }

    for (const [directory, group] of groups) {
      let targetFolder = folderId;
      if (directory) {
        const ensured = await ensureFolderPathAction({
          repositoryId,
          parentFolderId: folderId,
          relativeDirectory: directory,
        });
        if (!ensured.ok || !ensured.data) {
          toast(ensured.ok ? "Unable to create folders." : ensured.error, "error");
          continue;
        }
        targetFolder = ensured.data.folderId;
      }
      for (const file of group) {
        try {
          await uploadOne(file, targetFolder, file.name);
        } catch {
          // The queue already records the failed file.
        }
      }
    }
    refresh();
  }

  async function onFiles(fileList: FileList | File[], directory = false) {
    const selected = [...fileList];
    if (selected.length === 0) return;
    if (directory) {
      const withPaths = selected.map((file) => ({
        file,
        relativePath: "webkitRelativePath" in file && file.webkitRelativePath ? file.webkitRelativePath : file.name,
      }));
      await uploadList(withPaths);
      return;
    }
    await uploadList(selected.map((file) => ({ file, relativePath: file.name })));
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!canWrite) return;
    const entries = [...event.dataTransfer.items]
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    if (entries.length === 0) {
      await onFiles(event.dataTransfer.files);
      return;
    }
    const collected: { file: File; relativePath: string }[] = [];
    const walk = async (entry: FileSystemEntry, prefix: string) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        collected.push({ file, relativePath: `${prefix}${file.name}` });
        return;
      }
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children: FileSystemEntry[] = [];
      let batch: FileSystemEntry[] = [];
      do {
        batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        children.push(...batch);
      } while (batch.length > 0);
      for (const child of children) await walk(child, `${prefix}${entry.name}/`);
    };
    for (const entry of entries) await walk(entry, "");
    await uploadList(collected);
  }

  async function submitFolder(formData: FormData) {
    setBusy(true);
    const result = await createFolderAction({
      repositoryId,
      parentFolderId: folderId,
      name: String(formData.get("name") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return toast(result.error, "error");
    setDialog(null);
    toast("Folder created.");
    refresh();
  }

  async function submitFile(formData: FormData) {
    setBusy(true);
    const result = await createTextFileAction({
      repositoryId,
      folderId,
      name: String(formData.get("name") ?? ""),
      content: String(formData.get("content") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return toast(result.error, "error");
    setDialog(null);
    toast("File created.");
    refresh();
  }

  async function submitRename(formData: FormData) {
    if (!target) return;
    setBusy(true);
    const name = String(formData.get("name") ?? "");
    const result = target.kind === "folder"
      ? await renameFolderAction(repositoryId, target.id, name)
      : await renameFileAction(repositoryId, target.id, name);
    setBusy(false);
    if (!result.ok) return toast(result.error, "error");
    setMode(null);
    toast("Renamed.");
    refresh();
  }

  async function submitMove(formData: FormData) {
    if (!target) return;
    const value = String(formData.get("destination") ?? "");
    const destination = value === "root" ? null : value;
    setBusy(true);
    const result = target.kind === "folder"
      ? await moveFolderAction(repositoryId, target.id, destination)
      : await moveFileAction(repositoryId, target.id, destination);
    setBusy(false);
    if (!result.ok) return toast(result.error, "error");
    setMode(null);
    toast("Moved.");
    refresh();
  }

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    const result = target.kind === "folder"
      ? await deleteFolderAction(repositoryId, target.id)
      : await deleteFileAction(repositoryId, target.id);
    setBusy(false);
    if (!result.ok) return toast(result.error, "error");
    setMode(null);
    toast("Deleted.");
    refresh();
  }

  async function copyLink(path: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast("Link copied.");
  }

  const base = `/u/${username}/${slug}`;

  return (
    <section
      className={dragging ? "card drop-active" : "card"}
      onDragOver={(event) => {
        if (!canWrite) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap", padding: "0.9rem" }}>
        <nav aria-label="Breadcrumb" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href}>
              {index > 0 ? <span className="muted"> / </span> : null}
              <Link href={crumb.href}>{crumb.label}</Link>
            </span>
          ))}
        </nav>
        {canWrite ? (
          <div className="inline-actions">
            <button type="button" className="btn" onClick={() => inputRef.current?.click()}><Upload size={16} aria-hidden="true" /> Upload</button>
            <button type="button" className="btn" onClick={() => folderInputRef.current?.click()}><FolderPlus size={16} aria-hidden="true" /> Upload folder</button>
            <button type="button" className="btn" onClick={() => setDialog("folder")}>New folder</button>
            <button type="button" className="btn" onClick={() => setDialog("file")}>New file</button>
            <input ref={inputRef} hidden type="file" multiple onChange={(event) => event.target.files && void onFiles(event.target.files)} />
            <input
              ref={folderInputRef}
              hidden
              type="file"
              multiple
              {...{ webkitdirectory: "", directory: "" }}
              onChange={(event) => event.target.files && void onFiles(event.target.files, true)}
            />
          </div>
        ) : null}
      </div>

      {queue.length > 0 ? (
        <div style={{ padding: "0 0.9rem 0.9rem", display: "grid", gap: "0.45rem" }}>
          {queue.map((item) => (
            <div key={item.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{item.name}</span>
                <span className="muted">{item.status === "error" ? item.message : `${item.progress}%`}</span>
              </div>
              <div className="progress" aria-hidden="true"><span style={{ width: `${item.progress}%` }} /></div>
            </div>
          ))}
        </div>
      ) : null}

      {folders.length === 0 && files.length === 0 ? (
        <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
          <h2>This folder is empty.</h2>
          <p className="muted">Upload a file or create a folder to start organizing this repository.</p>
        </div>
      ) : (
        <div role="table" aria-label="Files">
          <div className="file-head" role="row">
            <span>Name</span><span className="hide-sm">Type</span><span className="hide-sm">Size</span><span className="hide-sm">Last modified</span><span>Actions</span>
          </div>
          {folders.map((folder) => {
            const href = `${base}/tree/${[...breadcrumbs.slice(1).map((crumb) => crumb.label), folder.name].map(encodeURIComponent).join("/")}`;
            return (
              <div className="file-row" role="row" key={folder.id}>
                <Link className="file-name" href={href}><KindIcon kind="folder" /><strong>{folder.name}</strong></Link>
                <span className="hide-sm muted">Folder</span>
                <span className="hide-sm muted">—</span>
                <span className="hide-sm muted">{formatDate(folder.updatedAt)}</span>
                <RowMenu
                  canWrite={canWrite}
                  downloadHref={`/api/folders/${folder.id}/archive`}
                  onOpen={() => router.push(href)}
                  onRename={() => { setTarget({ kind: "folder", id: folder.id, name: folder.name }); setMode("rename"); }}
                  onMove={() => { setTarget({ kind: "folder", id: folder.id, name: folder.name }); setMode("move"); }}
                  onDelete={() => { setTarget({ kind: "folder", id: folder.id, name: folder.name }); setMode("delete"); }}
                  onCopy={() => void copyLink(href)}
                />
              </div>
            );
          })}
          {files.map((file) => {
            const folderPath = breadcrumbs.slice(1).map((crumb) => crumb.label);
            const href = `${base}/blob/${[...folderPath, file.name].map(encodeURIComponent).join("/")}`;
            const kind = fileKind(file.mimeType, file.extension);
            return (
              <div className="file-row" role="row" key={file.id}>
                <Link className="file-name" href={href}><KindIcon kind={kind} /><strong>{file.name}</strong></Link>
                <span className="hide-sm muted">{kind}</span>
                <span className="hide-sm muted">{formatBytes(file.originalSize)}</span>
                <span className="hide-sm muted">{formatDate(file.updatedAt)}</span>
                <RowMenu
                  canWrite={canWrite}
                  previewHref={href}
                  downloadHref={`/api/files/${file.id}`}
                  onOpen={() => router.push(href)}
                  onRename={() => { setTarget({ kind: "file", id: file.id, name: file.name }); setMode("rename"); }}
                  onMove={() => { setTarget({ kind: "file", id: file.id, name: file.name }); setMode("move"); }}
                  onDelete={() => { setTarget({ kind: "file", id: file.id, name: file.name }); setMode("delete"); }}
                  onCopy={() => void copyLink(href)}
                />
              </div>
            );
          })}
        </div>
      )}

      {dialog ? (
        <dialog open>
          <form action={dialog === "folder" ? submitFolder : submitFile}>
            <h2>{dialog === "folder" ? "New folder" : "New file"}</h2>
            <label className="field">Name<input className="input" name="name" required autoFocus /></label>
            {dialog === "file" ? <label className="field">Content<textarea className="textarea" name="content" /></label> : null}
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setDialog(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} type="submit">Create</button>
            </div>
          </form>
        </dialog>
      ) : null}

      {mode === "rename" && target ? (
        <dialog open>
          <form action={submitRename}>
            <h2>Rename {target.name}</h2>
            <label className="field">Name<input className="input" name="name" defaultValue={target.name} required /></label>
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>Save</button>
            </div>
          </form>
        </dialog>
      ) : null}

      {mode === "move" && target ? (
        <dialog open>
          <form action={submitMove}>
            <h2>Move {target.name}</h2>
            <label className="field">Destination
              <select className="select" name="destination" defaultValue="root">
                {destinations.filter((option) => option.id !== target.id).map((option) => (
                  <option key={option.label} value={option.id ?? "root"}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>Move</button>
            </div>
          </form>
        </dialog>
      ) : null}

      {mode === "delete" && target ? (
        <dialog open>
          <h2>Delete “{target.name}”?</h2>
          <p>This action cannot be undone.</p>
          <div className="inline-actions">
            <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" disabled={busy} onClick={() => void confirmDelete()}>Delete</button>
          </div>
        </dialog>
      ) : null}

      {duplicate ? (
        <dialog open>
          <h2>File already exists.</h2>
          <p>“{duplicate.name}” is already in this folder.</p>
          <div className="inline-actions">
            <button className="btn" type="button" onClick={() => duplicate.choose("cancel")}>Cancel</button>
            <button className="btn" type="button" onClick={() => duplicate.choose("keep")}>Keep both</button>
            <button className="btn btn-primary" type="button" onClick={() => duplicate.choose("replace")}>Replace</button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}

function RowMenu({
  canWrite,
  downloadHref,
  previewHref,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onCopy,
}: {
  canWrite: boolean;
  downloadHref: string;
  previewHref?: string;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu">
      <button type="button" className="icon-btn" aria-label="Item actions" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="menu-panel card" role="menu">
          <button type="button" onClick={onOpen}>Open</button>
          {previewHref ? <Link href={previewHref}><span style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>Preview</span></Link> : null}
          <a href={downloadHref}><Download size={14} aria-hidden="true" /> Download</a>
          <button type="button" onClick={onCopy}><Link2 size={14} aria-hidden="true" /> Copy link</button>
          {canWrite ? <button type="button" onClick={onRename}>Rename</button> : null}
          {canWrite ? <button type="button" onClick={onMove}>Move</button> : null}
          {canWrite ? <button type="button" onClick={onDelete}>Delete</button> : null}
        </div>
      ) : null}
    </div>
  );
}
