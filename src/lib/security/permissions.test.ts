import { describe, expect, it } from "vitest";
import { canPerform, hasQuota, resolveRole } from "@/lib/security/permissions";

describe("repository permissions", () => {
  it("lets guests read a public repository and blocks writes", () => {
    const role = resolveRole({ userId: null, ownerId: "owner", collaboratorRole: null });
    expect(canPerform(role, "public", "read")).toBe(true);
    expect(canPerform(role, "public", "download")).toBe(true);
    expect(canPerform(role, "public", "preview")).toBe(true);
    expect(canPerform(role, "public", "upload")).toBe(false);
    expect(canPerform(role, "public", "delete_file")).toBe(false);
    expect(canPerform(role, "public", "change_visibility")).toBe(false);
  });

  it("hides private repositories from guests and other users", () => {
    const guest = resolveRole({ userId: null, ownerId: "owner", collaboratorRole: null });
    const stranger = resolveRole({ userId: "someone-else", ownerId: "owner", collaboratorRole: null });
    expect(canPerform(guest, "private", "read")).toBe(false);
    expect(canPerform(stranger, "private", "download")).toBe(false);
    expect(canPerform(stranger, "private", "upload")).toBe(false);
  });

  it("lets the owner manage a private repository", () => {
    const role = resolveRole({ userId: "owner", ownerId: "owner", collaboratorRole: null });
    expect(role).toBe("owner");
    expect(canPerform(role, "private", "read")).toBe(true);
    expect(canPerform(role, "private", "upload")).toBe(true);
    expect(canPerform(role, "private", "rename")).toBe(true);
    expect(canPerform(role, "private", "delete_repository")).toBe(true);
    expect(canPerform(role, "private", "change_visibility")).toBe(true);
  });

  it("prepares editor and viewer roles for later collaboration", () => {
    const editor = resolveRole({ userId: "editor", ownerId: "owner", collaboratorRole: "editor" });
    const viewer = resolveRole({ userId: "viewer", ownerId: "owner", collaboratorRole: "viewer" });
    expect(canPerform(editor, "private", "upload")).toBe(true);
    expect(canPerform(editor, "private", "delete_repository")).toBe(false);
    expect(canPerform(viewer, "private", "read")).toBe(true);
    expect(canPerform(viewer, "private", "upload")).toBe(false);
  });

  it("checks quota before an upload is accepted", () => {
    expect(hasQuota(40, 10, 50)).toBe(true);
    expect(hasQuota(40, 11, 50)).toBe(false);
    expect(hasQuota(0, 0, 0)).toBe(true);
  });
});
