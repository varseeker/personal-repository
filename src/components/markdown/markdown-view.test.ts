import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownView } from "@/components/markdown/markdown-view";

const sample = [
  "# Notes",
  "",
  "A paragraph.",
  "",
  "- alpha",
  "- beta",
  "  - nested",
  "",
  "1. first",
  "2. second",
  "",
  "- [ ] open task",
  "- [x] done task",
].join("\n");

describe("markdown view", () => {
  it("renders bullets, numbers, and task lists as lists", () => {
    const html = renderToStaticMarkup(createElement(MarkdownView, { markdown: sample }));
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("alpha");
    expect(html).toContain("nested");
    expect(html).toContain("first");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("open task");
    expect(html).toContain("contains-task-list");
    expect(html).toContain("task-list-item");
  });
});
