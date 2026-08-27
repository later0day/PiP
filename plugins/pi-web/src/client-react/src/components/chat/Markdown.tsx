import { type JSX, useMemo } from "react";
import { toSafeMarkdownHtml } from "@client/formatting/markdown";
import { splitMarkdownSegments } from "./markdownSegments";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import styles from "./Markdown.module.css";

// Phase 6k markdown seam: top-level fenced code blocks render as real CodeBlock
// cards (beautifului #18 shell — lang banner + copy + line numbers) via
// splitMarkdownSegments; every other construct still flows through the
// framework-agnostic toSafeMarkdownHtml (marked + sanitizer) parity seam and is
// injected with dangerouslySetInnerHTML. mdast/micromark + Shiki + KaTeX remain
// the later polish; this lands the code-copy structure without new deps.

export interface MarkdownProps {
  text: string;
}

export function Markdown({ text }: MarkdownProps): JSX.Element {
  const segments = useMemo(() => splitMarkdownSegments(text), [text]);

  return (
    <div className={styles.formatted} dir="auto">
      {segments.map((segment, index) =>
        segment.kind === "code" ? (
          <MarkdownCodeBlock key={index} lang={segment.lang} code={segment.code} />
        ) : (
          <div
            key={index}
            className={styles.htmlSegment}
            // output is sanitized by toSafeMarkdownHtml (marked + sanitizer)
            dangerouslySetInnerHTML={{ __html: toSafeMarkdownHtml(segment.markdown) }}
          />
        ),
      )}
    </div>
  );
}
