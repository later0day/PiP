import clsx from "clsx";
import { type JSX, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, SyntheticEvent } from "react";
import { lookup } from "../../lib/lookup";
import styles from "./ToolChips.module.css";

// ToolChips — beautifului tool-call run. A collapsible run header reveals
// staggered tool-call rows (each expandable to its detail steps), then a row of
// file-diff chips whose hover/focus opens a body-portaled diff preview. Ported
// verbatim from the real source; Tailwind → CSS Modules over DSH vars.

const STEP_MS = 700;

// Inline row-icon path data. Rendered inside an <svg> the row owns, so these are
// just the <path>/<g> contents keyed by icon name.
const Icons = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
  write: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </g>
  ),
  run: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l6-5-6-5M12 19h8" />
    </g>
  ),
  read: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </g>
  ),
} satisfies Record<string, ReactNode>;

interface DetailLine {
  text: string;
  tone?: "add";
}

interface ToolRow {
  icon: string;
  label: string;
  chip: string;
  mono: boolean;
  detailMono: boolean;
  detail: DetailLine[];
}

const ROWS: ToolRow[] = [
  {
    icon: "think",
    label: "Thinking",
    chip: "Planning the churn schedule…",
    mono: false,
    detailMono: false,
    detail: [
      { text: "Weekend demand carries pistachio, so it churns first." },
      { text: "Batch capacity leaves two evening freezer windows." },
    ],
  },
  {
    icon: "write",
    label: "Write 204 lines",
    chip: "ChurnSchedule.tsx",
    mono: true,
    detailMono: true,
    detail: [
      { text: "+ const windows = slots.filter((s) => s.temp <= -12)", tone: "add" },
      { text: '+ return schedule(windows, { hero: "pistachio" })', tone: "add" },
    ],
  },
  {
    icon: "run",
    label: "Rebuild and verify",
    chip: "npm run freeze",
    mono: true,
    detailMono: true,
    detail: [{ text: "✓ built in 1.2s" }, { text: "✓ 34 checks passed" }],
  },
  {
    icon: "read",
    label: "Read image",
    chip: "flavor-chart.png",
    mono: true,
    detailMono: false,
    detail: [
      { text: "1280 × 720 · line chart, three summers." },
      { text: "Mint chip trends up 12% through July." },
    ],
  },
];

interface Diff {
  file: string;
  add: number;
  del: number;
}

const DIFFS: Diff[] = [
  { file: "flavors.css", add: 13, del: 0 },
  { file: "ChurnSchedule.tsx", add: 74, del: 41 },
  { file: "menu.ts", add: 8, del: 2 },
];

interface DiffLine {
  text: string;
  tone: "add" | "del" | "ctx";
}

/* hovering a file chip opens its diff — green added, red removed */
const DIFF_LINES = {
  "flavors.css": [
    { text: ".scoop-card {", tone: "ctx" },
    { text: "  gap: 14px;", tone: "del" },
    { text: "  gap: 12px;", tone: "add" },
    { text: "  container-type: inline-size;", tone: "add" },
    { text: "}", tone: "ctx" },
  ],
  "ChurnSchedule.tsx": [
    { text: "const slots = coldSlots(week);", tone: "ctx" },
    { text: "const windows = slots;", tone: "del" },
    { text: "const windows = slots.filter(", tone: "add" },
    { text: "  (s) => s.temp <= -12,", tone: "add" },
    { text: ");", tone: "add" },
  ],
  "menu.ts": [
    { text: 'export const hero = "mint-chip";', tone: "del" },
    { text: 'export const hero = "pistachio";', tone: "add" },
  ],
} satisfies Record<string, DiffLine[]>;

interface Preview {
  file: string;
  x: number;
  top?: number;
  bottom?: number;
}

export function ToolChips(): JSX.Element {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  /* Rendered in a body portal so animated/translated reply wrappers cannot
   * redefine the fixed-position coordinate system. */
  const [preview, setPreview] = useState<Preview | null>(null);

  const openPreview = (file: string) => (event: SyntheticEvent) => {
    const chip = event.currentTarget.closest("[data-diffchip]");
    if (chip === null) return;
    const rect = chip.getBoundingClientRect();
    const lines = lookup(DIFF_LINES, file) ?? [];
    const previewHeight = 38 + lines.length * 19;
    const fitsBelow = rect.bottom + 6 + previewHeight <= window.innerHeight - 12;
    setPreview({
      file,
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      ...(fitsBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
    });
  };
  const closePreview = (file: string) => () =>
    { setPreview((current) => (current?.file === file ? null : current)); };

  const total = ROWS.length + 1; // rows, then diff chips

  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => { setStep((s) => s + 1); }, STEP_MS);
    return () => { clearTimeout(t); };
  }, [step, total]);

  const toggleRow = (label: string) =>
    { setOpenRows((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    }); };

  const previewLines = preview ? lookup(DIFF_LINES, preview.file) ?? [] : [];
  const previewDiff = preview ? DIFFS.find((diff) => diff.file === preview.file) : undefined;

  return (
    <div className={styles.root}>
      {/* collapsed run header */}
      <button type="button" aria-expanded={open} onClick={() => { setOpen((current) => !current); }} className={styles.header}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.headerChevron}
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className={styles.tnum}>4 tool calls, 2 messages</span>
      </button>

      {/* tool call rows */}
      <div className={styles.rowsGrid} style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
        {/* -mx-1 + px-1.5 keeps content at the same x while giving the
            row hover pills room inside this overflow-hidden clip box */}
        <div className={styles.rowsClip}>
          <div className={styles.rowsList}>
            {ROWS.slice(0, step).map((row) => {
              const rowOpen = openRows.has(row.label);
              return (
                <div key={row.label} className={styles.rowItem} style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
                  <button type="button" aria-expanded={rowOpen} onClick={() => { toggleRow(row.label); }} className={styles.rowBtn}>
                    <span className={styles.rowIconSlot}>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill={row.icon === "think" ? "currentColor" : "none"}
                        stroke="currentColor"
                        className={clsx(styles.rowIcon, rowOpen && styles.rowIconHidden)}
                      >
                        {lookup(Icons, row.icon) ?? null}
                      </svg>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={clsx(styles.rowChevron, rowOpen && styles.rowChevronOpen)}
                        style={{ transform: rowOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                    <span className={styles.rowLabel}>{row.label}</span>
                    <span className={clsx(styles.chip, row.mono && styles.mono)}>{row.chip}</span>
                  </button>

                  {/* expanded detail */}
                  <div
                    className={styles.detailGrid}
                    style={{
                      gridTemplateRows: rowOpen ? "1fr" : "0fr",
                      opacity: rowOpen ? 1 : 0,
                      transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                    }}
                  >
                    <div className={styles.detailClip}>
                      <div className={styles.detailBody}>
                        {row.detail.map((line) => (
                          <span
                            key={line.text}
                            className={clsx(styles.detailLine, row.detailMono && styles.mono, line.tone === "add" ? styles.detailAdd : styles.detailCtx)}
                          >
                            {line.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* file-diff chips */}
          {step >= total && (
            <div className={styles.chipsRow}>
              {DIFFS.map((d, i) => (
                <span key={d.file} data-diffchip className={styles.diffChipWrap} onMouseEnter={openPreview(d.file)} onMouseLeave={closePreview(d.file)}>
                  <button
                    type="button"
                    aria-expanded={preview?.file === d.file}
                    aria-label={`Show diff for ${d.file}`}
                    onFocus={openPreview(d.file)}
                    onBlur={closePreview(d.file)}
                    className={styles.diffChip}
                    style={{ animation: `pop-in 250ms cubic-bezier(0.23,1,0.32,1) ${String(i * 80)}ms both` }}
                  >
                    <span className={styles.diffFile}>{d.file}</span>
                    <span className={styles.diffAdd}>+{d.add}</span>
                    {d.del > 0 && <span className={styles.diffDel}>−{d.del}</span>}
                  </button>
                </span>
              ))}
              <button type="button" className={styles.moreBtn} style={{ animation: `fade-in 300ms ease-out ${String(DIFFS.length * 80)}ms both` }}>
                +2 more
              </button>
            </div>
          )}
        </div>
      </div>

      {preview &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.preview}
            style={{
              left: preview.x,
              top: preview.top,
              bottom: preview.bottom,
              animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both",
              transformOrigin: preview.top === undefined ? "bottom left" : "top left",
            }}
          >
            <div className={styles.previewHead}>
              <span className={styles.previewFile}>{preview.file}</span>
              <span className={styles.previewCount}>
                <span className={styles.textGreen}>+{previewDiff?.add}</span>
                {(previewDiff?.del ?? 0) > 0 && <span className={styles.textRed}> −{previewDiff?.del}</span>}
              </span>
            </div>
            <div className={styles.previewBody}>
              {previewLines.map((line, index) => (
                <div
                  key={index}
                  className={clsx(styles.previewLine, line.tone === "add" ? styles.lineAdd : line.tone === "del" ? styles.lineDel : styles.lineCtx)}
                >
                  <span className={styles.previewGutter}>{line.tone === "add" ? "+" : line.tone === "del" ? "−" : " "}</span>
                  <span className={styles.previewText}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
