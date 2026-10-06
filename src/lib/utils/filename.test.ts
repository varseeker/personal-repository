import { describe, expect, it } from "vitest";
import { nextDuplicateName, sanitizeFilename } from "@/lib/utils/filename";
import { pickReadme } from "@/lib/utils/readme";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

describe("names and paths", () => {
  it("rejects path traversal in file names", () => {
    expect(sanitizeFilename("../../secret.txt")).toBe("secret.txt");
    expect(sanitizeFilename("..")).toBe("");
    expect(sanitizeFilename("notes.md")).toBe("notes.md");
  });

  it("keeps both copies by adding a numeric suffix", () => {
    const existing = new Set(["project.zip", "project (1).zip"]);
    expect(nextDuplicateName("project.zip", existing)).toBe("project (2).zip");
  });

  it("slugifies repository names and avoids collisions", () => {
    expect(slugify("My Project")).toBe("my-project");
    expect(uniqueSlug("my-project", new Set(["my-project"]))).toBe("my-project-2");
  });

  it("picks the root README in priority order", () => {
    const chosen = pickReadme([
      { name: "readme" },
      { name: "README.md" },
      { name: "notes.md" },
    ]);
    expect(chosen?.name).toBe("README.md");
  });
});
