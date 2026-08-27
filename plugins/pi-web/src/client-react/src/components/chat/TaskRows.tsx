import clsx from "clsx";
import { type JSX, useState } from "react";
import type { ReactNode } from "react";
import { useTick } from "../../hooks";
import styles from "./TaskRows.module.css";

// TaskRows — beautifului task-run list. Rows enter staggered; row 1 shows a
// completed check, row 2 spins live, row 3 flips pending → failed (with retry)
// → completed on a scripted tick timeline. Each row expands to its detail
// steps. Ported verbatim; Tailwind → CSS Modules over DSH vars.

/* ─────────────────────────────────────────────────────────
 * TASK ROWS
 *
 *     0ms   rows enter staggered (80ms apart)
 *   600ms   row 1 ring sweeps 0 → 66%
 *  1500ms   row 1 expands — detail steps drop down
 *  3900ms   row 1 collapses; row 2 flips to Failed + retry
 *  5300ms   row 2 resolves to Completed
 * The status run completes once; task details stay clickable.
 * ───────────────────────────────────────────────────────── */

const TICKS = [600, 900, 2400, 1400, 2400, 600];

function SpinnerRing({ active, children }: { active?: boolean; children?: ReactNode }): JSX.Element {
  const size = 24;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={styles.spinnerWrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} className={styles.spinnerSvg} style={active === true ? { animation: "spin 1.1s linear infinite" } : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {active === true && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${String(c * 0.28)} ${String(c * 0.72)}`}
          />
        )}
      </svg>
      <span className={styles.spinnerLabel}>{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: ReactNode }): JSX.Element {
  return (
    <span
      className={clsx(styles.badge, tone === "red" ? styles.badgeRed : styles.badgeGreen)}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const RetryIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
  </svg>
);

interface TaskDetail {
  label: string;
  meta: string;
}

interface TaskRow {
  key: string;
  badge: ReactNode;
  label: string;
  amount: string;
  pill: ReactNode;
  details: TaskDetail[];
}

export interface TaskRowsProps {
  variant?: string;
}

export function TaskRows({ variant = "Capsules" }: TaskRowsProps): JSX.Element {
  const tick = useTick(TICKS);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const row2: "pending" | "failed" | "done" = tick < 3 ? "pending" : tick === 3 ? "failed" : "done";

  const rows: TaskRow[] = [
    {
      key: "verify",
      badge: <Badge tone="green">{CheckIcon}</Badge>,
      label: "Verified vendor records",
      amount: "12 suppliers",
      pill: <span className={clsx(styles.pill, styles.pillGreen)}>Completed</span>,
      details: [
        { label: "Matched tax and contact IDs", meta: "12/12" },
        { label: "Flagged stale records", meta: "0" },
      ],
    },
    {
      key: "index",
      badge: <SpinnerRing active>2</SpinnerRing>,
      label: "Build reorder task list",
      amount: "7 SKUs",
      pill: null,
      details: [
        { label: "Reading POS export", meta: "3 files" },
        { label: "Scoring stockout risk", meta: "68%" },
      ],
    },
    {
      key: "draft",
      badge:
        row2 === "pending" ? (
          <SpinnerRing>3</SpinnerRing>
        ) : row2 === "failed" ? (
          <Badge tone="red">{XIcon}</Badge>
        ) : (
          <Badge tone="green">{CheckIcon}</Badge>
        ),
      label: "Draft supplier emails",
      amount: "2 messages",
      pill:
        row2 === "failed" ? (
          <span className={clsx(styles.pill, styles.pillRed)} style={{ animation: "fade-in 200ms ease-out both" }}>
            Failed{" "}
            <span style={{ animation: "spin 1.2s linear infinite" }} className={styles.retrySpin}>
              {RetryIcon}
            </span>
          </span>
        ) : row2 === "done" ? (
          <span className={clsx(styles.pill, styles.pillGreen)} style={{ animation: "fade-in 200ms ease-out both" }}>
            Completed
          </span>
        ) : null,
      details: [
        { label: "Cone supplier follow-up", meta: "draft" },
        { label: "Pistachio reorder note", meta: "draft" },
      ],
    },
  ];

  const list = variant === "List";
  return (
    <div className={clsx(styles.root, list ? styles.rootList : styles.rootCapsules)}>
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? (row.key === "index" && tick === 2);
        return (
          <div
            key={row.key}
            className={clsx(styles.rowShell, list ? styles.rowShellList : styles.rowShellCapsule)}
            style={{
              borderRadius: list ? 0 : open ? 14 : 22,
              animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${String(i * 80)}ms both`,
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => { setManualOpen((current) => ({ ...current, [row.key]: !open })); }}
              className={styles.rowBtn}
            >
              <span className={styles.badgeSlot}>{row.badge}</span>
              <span className={styles.rowLabel}>{row.label}</span>
              <span className={styles.rowAmount}>{row.amount}</span>
              {row.pill}
              <span aria-hidden="true" className={styles.chevronSlot}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.chevron}
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {/* dropdown detail — same expandable grammar as Chain of Thought */}
            <div
              className={styles.detailGrid}
              style={{
                gridTemplateRows: open ? "1fr" : "0fr",
                opacity: open ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <div className={styles.detailClip}>
                <div className={styles.detailInner}>
                  <span aria-hidden className={styles.detailRule} />
                  <div className={styles.detailList}>
                    {row.details.map((d, j) => (
                      <div
                        key={d.label}
                        className={styles.detailItem}
                        style={open ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${String(120 + j * 100)}ms both` } : undefined}
                      >
                        <span className={styles.detailLabel}>{d.label}</span>
                        <span className={styles.detailMeta}>{d.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
