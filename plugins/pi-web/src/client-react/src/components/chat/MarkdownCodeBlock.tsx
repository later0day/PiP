import clsx from "clsx";
import { type JSX, useCallback, useState } from "react";
import { highlight } from "./CodeBlock";
import styles from "./CodeBlock.module.css";

// MarkdownCodeBlock — Phase 6k. A live-data fenced code block for chat markdown,
// wearing the beautifului #18 CodeBlock shell (rounded card, hairline header,
// line numbers + rail, copy button). Where the gallery CodeBlock demo shows a
// filename, the markdown variant shows the fence language label. Content comes
// from splitMarkdownSegments (real message text), not the demo fixture. Shiki
// syntax highlighting stays deferred (acceptance table marks #18 "Shiki polish");
// today it reuses CodeBlock's lightweight TS/JS-leaning tokenizer.

export interface MarkdownCodeBlockProps {
  lang: string;
  code: string;
}

function langLabel(lang: string): string {
  return lang === "" ? "code" : lang;
}

export function MarkdownCodeBlock({ lang, code }: MarkdownCodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => { setCopied(false); }, 1500);
      },
      () => {
        /* clipboard denied — leave the label unchanged */
      },
    );
  }, [code]);

  return (
    <div className={styles.card} style={{ maxWidth: "none" }}>
      <div className={styles.header}>
        <span className={styles.fileWrap}>
          <span className={styles.fileName}>{langLabel(lang)}</span>
        </span>
        <button
          type="button"
          aria-label="复制代码"
          onClick={copy}
          className={clsx(styles.copyBtn, copied ? styles.copyBtnCopied : styles.copyBtnIdle)}
        >
          {copied ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.lines}>
          <span aria-hidden className={styles.rail} />
          {lines.map((line, i) => (
            <div key={i} className={styles.line}>
              <span className={clsx(styles.num, styles.numCtx)}>{i + 1}</span>
              <code className={styles.code}>{line === "" ? " " : highlight(line)}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
