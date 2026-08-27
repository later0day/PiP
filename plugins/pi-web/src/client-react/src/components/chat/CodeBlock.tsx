import clsx from "clsx";
import { type JSX, useCallback, useState } from "react";
import type { ReactNode } from "react";
import styles from "./CodeBlock.module.css";

// CodeBlock — beautifului. A source card with two variants: plain "Code" (line
// numbers + copy button) and "Diff" (add/del gutter, hatch bar, +/- stat). Ships
// a tiny inline TS/JS syntax tokenizer (KEYWORDS + TOKEN regex). Ported verbatim
// from the real source; Tailwind → CSS Modules over DSH bridge vars.

const FILE = "churn.ts";

const CODE_LINES = [
  "export async function churnBatch() {",
  '  const flavor = await getFlavor("pistachio");',
  "  const base = await dairy.fetch({ flavor });",
  '  await freezer.store(base, { temp: "-16C" });',
  "  if (!base.approved) return null;",
  "  return base.gallons;",
  "}",
];
const RAW = CODE_LINES.join("\n");

interface Piece {
  text: string;
  change?: "add" | "del";
}
interface DiffLine {
  old: number | null;
  cur: number | null;
  type: "ctx" | "add" | "del";
  pieces: Piece[];
}

const DIFF: DiffLine[] = [
  { old: 1, cur: 1, type: "ctx", pieces: [{ text: "export async function churnBatch() {" }] },
  { old: 2, cur: 2, type: "ctx", pieces: [{ text: '  const flavor = await getFlavor("pistachio");' }] },
  { old: 3, cur: 3, type: "ctx", pieces: [{ text: "  const base = await dairy.fetch({ flavor });" }] },
  { old: 4, cur: null, type: "del", pieces: [{ text: "  await freezer.store(base, { temp: " }, { text: '"-14C"', change: "del" }, { text: " });" }] },
  { old: null, cur: 4, type: "add", pieces: [{ text: "  await freezer.store(base, { temp: " }, { text: '"-16C"', change: "add" }, { text: " });" }] },
  { old: null, cur: 5, type: "add", pieces: [{ text: "  if (!base.approved) return null;" }] },
  { old: 5, cur: 6, type: "ctx", pieces: [{ text: "  return base.gallons;" }] },
  { old: 6, cur: 7, type: "ctx", pieces: [{ text: "}" }] },
];

const HATCH = "repeating-linear-gradient(45deg, var(--red) 0, var(--red) 1.5px, transparent 1.5px, transparent 3px)";

/* light syntax coloring — keywords/imports/conditionals, functions, strings & numbers */
const KEYWORDS = new Set(["import", "from", "export", "default", "async", "function", "const", "let", "var", "await", "return", "if", "else", "for", "while", "new", "throw", "try", "catch", "null", "true", "false", "undefined"]);
const TOKEN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g;

export function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index;
    const t = m[0];
    if (idx > last) nodes.push(<span key={k++}>{text.slice(last, idx)}</span>);
    let color: string;
    let weight: number | undefined;
    if (/^["'`]/.test(t) || /^\d/.test(t)) color = "var(--orange)"; // string / number
    else if (KEYWORDS.has(t)) color = "var(--accent-ink)"; // keyword / import / conditional
    else { color = "var(--ink)"; weight = 500; } // function call
    nodes.push(<span key={k++} style={{ color, fontWeight: weight }}>{t}</span>);
    last = idx + t.length;
  }
  if (last < text.length) nodes.push(<span key={k}>{text.slice(last)}</span>);
  return nodes;
}

function Pieces({ pieces }: { pieces: Piece[] }): JSX.Element {
  return (
    <>
      {pieces.map((p, i) => {
        if (p.change) {
          const add = p.change === "add";
          return (
            <span
              key={i}
              className={styles.pieceChange}
              style={{
                background: `color-mix(in srgb, var(--${add ? "green" : "red"}) 18%, transparent)`,
                padding: "0 2px",
                margin: "0 -1px",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              {highlight(p.text)}
            </span>
          );
        }
        return <span key={i}>{highlight(p.text)}</span>;
      })}
    </>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.fileIcon}>
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

export interface CodeBlockProps {
  /** "Code" (default) shows line numbers + copy; "Diff" shows the add/del diff */
  variant?: string;
}

export function CodeBlock({ variant = "Code" }: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const isDiff = variant === "Diff";

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(RAW).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 1500);
    });
  }, []);

  const added = DIFF.filter((r) => r.type === "add").length;
  const removed = DIFF.filter((r) => r.type === "del").length;

  return (
    <div className={styles.card}>
      {/* header — file · (diff stat | copy) */}
      <div className={styles.header}>
        <span className={styles.fileWrap}>
          <FileIcon />
          <span className={styles.fileName}>{FILE}</span>
        </span>

        {isDiff ? (
          <span className={styles.stat}>
            <span className={styles.statAdd}>+{added}</span>
            <span className={styles.statDel}>-{removed}</span>
          </span>
        ) : (
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
        )}
      </div>

      {/* body — equal 12px inset on top / left / right; lines wrap */}
      <div className={styles.body}>
        {isDiff ? (
          <div className={styles.lines}>
            <span aria-hidden className={styles.rail} />
            {DIFF.map((r, i) => {
              const add = r.type === "add";
              const del = r.type === "del";
              // one gutter column: removals keep the old number, additions/context show the new one
              const num = del ? r.old : r.cur;
              return (
                <div
                  key={i}
                  className={clsx(styles.line, add ? styles.lineAdd : del ? styles.lineDel : "")}
                >
                  {(add || del) && (
                    <span className={styles.marker} style={{ background: add ? "var(--green)" : HATCH }} />
                  )}
                  <span className={clsx(styles.num, add ? styles.numAdd : del ? styles.numDel : styles.numCtx)}>{num ?? ""}</span>
                  <code className={styles.code}>
                    <Pieces pieces={r.pieces} />
                  </code>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.lines}>
            <span aria-hidden className={styles.rail} />
            {CODE_LINES.map((line, i) => (
              <div key={i} className={styles.line}>
                <span className={clsx(styles.num, styles.numCtx)}>{i + 1}</span>
                <code className={styles.code}>{highlight(line)}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
