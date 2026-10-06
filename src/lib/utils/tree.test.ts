import { describe, expect, it } from "vitest";
import { descendantFolderIds, resolveFolderPath } from "@/lib/utils/tree";
import type { Folder } from "@/types/folder";

const folders: Folder[] = [
  { id: "src", repository_id: "repo", parent_folder_id: null, name: "src", created_at: "", updated_at: "" },
  { id: "components", repository_id: "repo", parent_folder_id: "src", name: "components", created_at: "", updated_at: "" },
  { id: "docs", repository_id: "repo", parent_folder_id: null, name: "docs", created_at: "", updated_at: "" },
];

describe("folder tree", () => {
  it("resolves a nested path and rejects missing segments", () => {
    expect(resolveFolderPath(folders, ["src", "components"])?.id).toBe("components");
    expect(resolveFolderPath(folders, ["src", "missing"])).toBeNull();
  });

  it("collects descendants before a folder delete", () => {
    expect([...descendantFolderIds(folders, "src")].sort()).toEqual(["components", "src"]);
    expect(descendantFolderIds(folders, "docs").has("src")).toBe(false);
  });
});
