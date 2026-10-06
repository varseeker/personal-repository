import "server-only";
import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { languageFromExtension } from "@/lib/utils/file-kind";

const SUPPORTED = new Set([
  "typescript", "tsx", "javascript", "jsx", "json", "css", "html", "markdown",
  "python", "java", "sql", "yaml", "xml", "php", "csharp", "go", "rust", "bash",
  "scss", "ruby",
]);

let highlighterPromise: Promise<Highlighter> | null = null;

function highlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-dark"],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function highlightCode(code: string, extension: string | null): Promise<string> {
  const language = languageFromExtension(extension);
  if (!SUPPORTED.has(language) || code.length > 200_000) {
    return `<pre class="code-fallback"><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    const engine = await highlighter();
    const loaded = engine.getLoadedLanguages();
    if (!loaded.includes(language)) {
      await engine.loadLanguage(language as "typescript");
    }
    return engine.codeToHtml(code, { lang: language, theme: "github-dark" });
  } catch {
    return `<pre class="code-fallback"><code>${escapeHtml(code)}</code></pre>`;
  }
}
