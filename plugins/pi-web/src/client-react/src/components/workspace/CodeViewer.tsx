import { type JSX, useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css as cssLang } from "@codemirror/lang-css";
import { html as htmlLang } from "@codemirror/lang-html";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import styles from "./CodeViewer.module.css";

// Phase 5a: read-only CodeMirror 6 source view. A thin React wrapper around the
// same extension/theme set the legacy <code-viewer> used, re-created on
// content/language change (CodeMirror owns the DOM inside the ref host). The
// theme reads the DSH-backed tokens rather than the legacy --pi-* palette.

export interface CodeViewerProps {
  content: string;
  language?: string;
}

export function CodeViewer({ content, language }: CodeViewerProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          keymap.of(defaultKeymap),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          viewerTheme,
          ...bidiTextExtensions(language),
          ...languageExtensions(language),
        ],
      }),
    });
    return () => {
      view.destroy();
    };
  }, [content, language]);

  return <div ref={hostRef} className={styles.host} />;
}

const viewerTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--ink)",
    backgroundColor: "var(--surface)",
    fontSize: "12px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)",
    lineHeight: "1.45",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--ink-3)",
    borderRight: "1px solid var(--line-soft)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-content": { caretColor: "transparent" },
  "&.cm-focused": { outline: "none" },
});

const bidiTextTheme = EditorView.theme({
  ".cm-content": { textAlign: "start" },
  ".cm-line": { unicodeBidi: "plaintext" },
});

function bidiTextExtensions(language: string | undefined): Extension[] {
  return language === "markdown" ? [EditorView.contentAttributes.of({ dir: "auto" }), bidiTextTheme] : [];
}

function languageExtensions(language: string | undefined): Extension[] {
  if (language === undefined) return [];
  switch (language) {
    case "typescript": return [javascript({ typescript: true })];
    case "javascript": return [javascript()];
    case "json": return [json()];
    case "markdown": return [markdown()];
    case "css": return [cssLang()];
    case "html": return [htmlLang()];
    case "python": return [python()];
    case "rust": return [rust()];
    case "go": return [go()];
    case "diff": return [StreamLanguage.define(diff)];
    default: return [];
  }
}
