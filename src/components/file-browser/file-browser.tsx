"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { FilePreview } from "@/components/file-preview/file-preview";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement>(null);
  const selected = files.find((item) => item.id === selectedId) ?? null;

  function selectFile(fileId: string) {
    setSelectedId(fileId);
    requestAnimationFrame(() => previewRef.current?.scrollIntoView({ block: "nearest" }));
  }

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
      className={dragging ? "card browser drop-active" : "card browser"}
      onDragOver={(event) => {
        if (!canWrite) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="browser-bar">
        <nav className="crumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href}>
              {index > 0 ? <span className="muted"> / </span> : null}
              <Link href={crumb.href}>{crumb.label}</Link>
            </span>
          ))}
        </nav>
        {canWrite ? (
          <div className="inline-actions">
            <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}><Upload size={16} aria-hidden="true" /> Upload</button>
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
        <div className="upload-queue">
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
        <div className="browser-empty">
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
            const isSelected = selectedId === file.id;
            return (
              <div className="file-row" role="row" key={file.id} data-selected={isSelected || undefined}>
                <button type="button" className="file-name" aria-pressed={isSelected} onClick={() => selectFile(file.id)}>
                  <KindIcon kind={kind} /><strong>{file.name}</strong>
                </button>
                <span className="hide-sm muted">{kind}</span>
                <span className="hide-sm muted">{formatBytes(file.originalSize)}</span>
                <span className="hide-sm muted">{formatDate(file.updatedAt)}</span>
                <RowMenu
                  canWrite={canWrite}
                  downloadHref={`/api/files/${file.id}`}
                  onOpen={() => router.push(href)}
                  onPreview={() => selectFile(file.id)}
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

      {selected ? (
        <section className="file-preview" ref={previewRef} aria-label={`Preview of ${selected.name}`}>
          <div className="file-preview-bar">
            <h2>{selected.name}</h2>
            <div className="inline-actions">
              <Link className="btn" href={`${base}/blob/${[...breadcrumbs.slice(1).map((crumb) => crumb.label), selected.name].map(encodeURIComponent).join("/")}`}>Open</Link>
              <a className="btn" href={`/api/files/${selected.id}`}>Download</a>
              <button type="button" className="btn" onClick={() => setSelectedId(null)}>Close</button>
            </div>
          </div>
          <FilePreview file={selected} />
        </section>
      ) : null}

      {dialog ? (
        <Modal onClose={() => { if (!busy) setDialog(null); }}>
          <form action={dialog === "folder" ? submitFolder : submitFile}>
            <h2>{dialog === "folder" ? "New folder" : "New file"}</h2>
            <label className="field">Name<input className="input" name="name" required autoFocus /></label>
            {dialog === "file" ? <label className="field">Content<textarea className="textarea" name="content" /></label> : null}
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setDialog(null)}>Cancel</button>
              <SubmitButton className="btn btn-primary" disabled={busy} pendingLabel="Creating…">Create</SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {mode === "rename" && target ? (
        <Modal onClose={() => { if (!busy) setMode(null); }}>
          <form action={submitRename}>
            <h2>Rename {target.name}</h2>
            <label className="field">Name<input className="input" name="name" defaultValue={target.name} required /></label>
            <div className="inline-actions" style={{ marginTop: "0.8rem" }}>
              <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
              <SubmitButton className="btn btn-primary" disabled={busy} pendingLabel="Saving…">Save</SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {mode === "move" && target ? (
        <Modal onClose={() => { if (!busy) setMode(null); }}>
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
              <SubmitButton className="btn btn-primary" disabled={busy} pendingLabel="Moving…">Move</SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {mode === "delete" && target ? (
        <Modal onClose={() => { if (!busy) setMode(null); }}>
          <h2>Delete “{target.name}”?</h2>
          <p>This action cannot be undone.</p>
          <div className="inline-actions">
            <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" disabled={busy} aria-busy={busy || undefined} onClick={() => void confirmDelete()}>{busy ? "Deleting…" : "Delete"}</button>
          </div>
        </Modal>
      ) : null}

      {duplicate ? (
        <Modal onClose={() => duplicate.choose("cancel")}>
          <h2>File already exists.</h2>
          <p>“{duplicate.name}” is already in this folder.</p>
          <div className="inline-actions">
            <button className="btn" type="button" onClick={() => duplicate.choose("cancel")}>Cancel</button>
            <button className="btn" type="button" onClick={() => duplicate.choose("keep")}>Keep both</button>
            <button className="btn btn-primary" type="button" onClick={() => duplicate.choose("replace")}>Replace</button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function RowMenu({
  canWrite,
  downloadHref,
  onOpen,
  onPreview,
  onRename,
  onMove,
  onDelete,
  onCopy,
}: {
  canWrite: boolean;
  downloadHref: string;
  onOpen: () => void;
  onPreview?: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number | "auto"; bottom: number | "auto"; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function place() {
    const button = rootRef.current?.querySelector("button");
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 256;
    const left = Math.round(Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setPosition(openUp
      ? { top: "auto", bottom: Math.round(window.innerHeight - rect.top + 6), left }
      : { top: Math.round(rect.bottom + 6), bottom: "auto", left });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setPosition(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setPosition(null);
      }
    }
    function onLayout() {
      place();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    setPosition(null);
    action();
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Item actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) {
            setOpen(false);
            setPosition(null);
            return;
          }
          place();
          setOpen(true);
        }}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && position ? createPortal(
        <div
          ref={panelRef}
          className="menu-panel card"
          role="menu"
          style={{ position: "fixed", top: position.top, bottom: position.bottom, left: position.left, zIndex: 90 }}
        >
          <button type="button" role="menuitem" onClick={() => choose(onOpen)}>Open</button>
          {onPreview ? <button type="button" role="menuitem" onClick={() => choose(onPreview)}>Preview</button> : null}
          <a role="menuitem" href={downloadHref} onClick={() => setOpen(false)}><Download size={14} aria-hidden="true" /> Download</a>
          <button type="button" role="menuitem" onClick={() => choose(onCopy)}><Link2 size={14} aria-hidden="true" /> Copy link</button>
          {canWrite ? <button type="button" role="menuitem" onClick={() => choose(onRename)}>Rename</button> : null}
          {canWrite ? <button type="button" role="menuitem" onClick={() => choose(onMove)}>Move</button> : null}
          {canWrite ? <button type="button" role="menuitem" onClick={() => choose(onDelete)}>Delete</button> : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
