"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { headingId } from "@/lib/utils/readme";

function textValue(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textValue).join("");
  return "";
}

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a({ href, children }) {
            const external = typeof href === "string" && /^https?:\/\//.test(href);
            return (
              <a href={href} rel={external ? "noreferrer noopener" : undefined} target={external ? "_blank" : undefined}>
                {children}
              </a>
            );
          },
          h1({ children }) {
            return <h1 id={headingId(textValue(children))}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 id={headingId(textValue(children))}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 id={headingId(textValue(children))}>{children}</h3>;
          },
          img({ src, alt }) {
            if (typeof src !== "string" || !/^https?:\/\//.test(src)) return null;
            return <img src={src} alt={alt ?? ""} />;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownToc({ markdown }: { markdown: string }) {
  const headings = markdown
    .split("\n")
    .map((line) => /^(#{1,3})\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ level: match[1].length, text: match[2].trim() }));

  if (headings.length === 0) return null;

  return (
    <nav className="card toc" aria-label="Table of contents" style={{ padding: "0.9rem 1rem", marginBottom: "1rem" }}>
      <strong>Contents</strong>
      {headings.map((heading) => (
        <a key={`${heading.level}-${heading.text}`} href={`#${headingId(heading.text)}`} style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}>
          {heading.text}
        </a>
      ))}
    </nav>
  );
}
