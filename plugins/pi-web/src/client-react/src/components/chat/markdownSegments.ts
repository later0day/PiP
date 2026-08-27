import { marked } from "marked";

// markdownSegments — Phase 6k. Split chat markdown into an ordered list of
// segments so top-level fenced code blocks can render as real CodeBlock cards
// (language banner + copy + line numbers, the beautifului #18 structure) while
// every other construct keeps flowing through the existing sanitized-HTML parity
// seam (toSafeMarkdownHtml). We slice with marked's own block lexer so the split
// respects the exact same tokenizer the HTML path uses — no second parser, no
// new deps. Indented code blocks (4-space) and inline code are left to the HTML
// path; only fenced blocks (``` / ~~~) become cards.

export interface MarkdownHtmlSegment {
  kind: "html";
  /** Raw markdown for this run of non-fenced tokens; rendered via toSafeMarkdownHtml. */
  markdown: string;
}

export interface MarkdownCodeSegment {
  kind: "code";
  /** Fence info string (may be ""); first word is the language. */
  lang: string;
  /** The code body, exactly as authored (no trailing newline). */
  code: string;
}

export type MarkdownSegment = MarkdownHtmlSegment | MarkdownCodeSegment;

// A fenced code token's raw begins with a run of ``` or ~~~ (after marked has
// already stripped any leading blockquote/list context — top-level only here).
function isFencedCode(raw: string): boolean {
  const trimmed = raw.trimStart();
  return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

// The fence language is the first whitespace-delimited word of the info string.
function fenceLanguage(lang: string | undefined): string {
  if (lang === undefined) return "";
  const first = lang.trim().split(/\s+/, 1)[0];
  return first ?? "";
}

export function splitMarkdownSegments(text: string): MarkdownSegment[] {
  let tokens: { type: string; raw: string; lang?: string; text?: string }[];
  try {
    tokens = marked.lexer(text, { gfm: true, breaks: true });
  } catch {
    // If the lexer throws for any reason, fall back to a single HTML segment so
    // the message still renders (parity with the pre-6k behavior).
    return [{ kind: "html", markdown: text }];
  }

  const segments: MarkdownSegment[] = [];
  let htmlBuffer = "";

  const flushHtml = (): void => {
    if (htmlBuffer === "") return;
    segments.push({ kind: "html", markdown: htmlBuffer });
    htmlBuffer = "";
  };

  for (const token of tokens) {
    if (token.type === "code" && isFencedCode(token.raw)) {
      flushHtml();
      segments.push({
        kind: "code",
        lang: fenceLanguage(token.lang),
        code: token.text ?? "",
      });
      continue;
    }
    htmlBuffer += token.raw;
  }
  flushHtml();

  // An all-HTML message collapses to the single-segment fast path.
  if (segments.length === 0) return [{ kind: "html", markdown: text }];
  return segments;
}
