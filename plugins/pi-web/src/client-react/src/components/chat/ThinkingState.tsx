import clsx from "clsx";
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSequence } from "../../hooks";
import { Shimmer } from "../../primitives";
import { lookup } from "../../lib/lookup";
import styles from "./ThinkingState.module.css";

// ThinkingState — beautifului #2. An expandable agent trace in four variants
// (Steps / Reasoning / Search / Coding). The trace runs once via useSequence,
// settles, and stays expandable. Ported verbatim; Tailwind → CSS Modules over
// DSH vars; role/aria/keyboard preserved.

// One-shot reveal choreography (ms between stages). Drives the trace.
const STAGES = [800, 600, 1800, 2600, 1600];

interface Row {
  primary: string;
  secondary?: string;
  mono?: boolean;
  add?: number;
  del?: number;
  href?: string;
}

interface Variant {
  active: string;
  done: string;
  rows: Row[];
  query?: string;
}

const VARIANTS = {
  Steps: {
    active: "Thinking",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Reading flavor briefs" },
      { primary: "Scanning supplier lists" },
      { primary: "Comparing tasting notes", secondary: "6 flavors" },
      { primary: "Writing the scoop report" },
    ],
  },
  Reasoning: {
    active: "Thinking",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Summer demand spikes for stone-fruit flavors — peach and apricot lead." },
      { primary: "I should check cone inventory before promoting a waffle-bowl special." },
    ],
  },
  Search: {
    active: "Searching the web",
    done: "Searched the web",
    query: "best waffle cone supplier",
    rows: [
      { primary: "Joy Cone", secondary: "joycone.com", href: "https://joycone.com/fs_products/waffle-cones/" },
      { primary: "WebstaurantStore", secondary: "webstaurantstore.com", href: "https://www.webstaurantstore.com/ice-cream-shop-supplies.html" },
      { primary: "The Konery", secondary: "thekonery.com", href: "https://www.thekonery.com/" },
    ],
  },
  Coding: {
    active: "Running tools",
    done: "Ran 3 tools",
    rows: [
      { primary: "Read", secondary: "flavors.ts", mono: true },
      { primary: "Edit", secondary: "ChurnSchedule.tsx", mono: true, add: 74, del: 41 },
      { primary: "Run", secondary: "npm run freeze", mono: true },
    ],
  },
} satisfies Record<string, Variant>;

// tone bg classes cycled per search source
const TONES: string[] = [styles.toneAccent ?? "", styles.toneOrange ?? "", styles.toneGreen ?? ""];

function Dot({ tone }: { tone: string }): JSX.Element {
  return (
    <span className={clsx(styles.dot, tone)}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  );
}

export interface ThinkingStateProps {
  variant?: string;
  /** fires once when the trace has finished running */
  onSettled?: () => void;
}

export function ThinkingState({ variant = "Steps", onSettled }: ThinkingStateProps): JSX.Element {
  const stage = useSequence(STAGES);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const v: Variant = lookup(VARIANTS, variant) ?? VARIANTS.Steps;
  const autoExpanded = stage >= 1 && stage < 4;
  const expanded = manualExpanded ?? autoExpanded;
  const working = stage < 3;
  const visible = stage < 2 ? 0 : stage === 2 ? Math.min(2, v.rows.length) : v.rows.length;
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [visible, expanded, variant, stage]);

  /* let embedders sequence content after the trace settles */
  const settledRef = useRef(false);
  useEffect(() => {
    if (working || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [working, onSettled]);

  return (
    <div
      key={variant}
      className={styles.root}
      style={{
        minHeight: working || expanded ? 176 : undefined,
        transition: "min-height 400ms cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* header — shared across variants */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => { setManualExpanded((current) => !(current ?? autoExpanded)); }}
        className={styles.header}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={working ? "var(--ink-2)" : "var(--ink-3)"}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className={styles.statusContents}>
          {working ? (
            <Shimmer className={styles.active}>{v.active}</Shimmer>
          ) : (
            <span className={styles.done} style={{ animation: "fade-in 350ms ease-out both" }}>
              {v.done}
            </span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.chevron}
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* expandable trace */}
      <div
        className={styles.traceGrid}
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className={styles.clip}>
          <div className={styles.traceInner}>
            <span
              aria-hidden
              className={styles.line}
              style={{ top: -8, height: lineHeight ? lineHeight - 2 : 0, transition: "height 500ms cubic-bezier(0.23,1,0.32,1)" }}
            />
            <div ref={traceRef} className={styles.trace}>
              {v.query !== undefined && (
                <div className={styles.query} style={{ animation: expanded ? "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" : undefined }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className={styles.shrink}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <span className={styles.queryText}>{v.query}</span>
                </div>
              )}
              {v.rows.slice(0, visible).map((row, i) => {
                const content = (
                  <>
                    {variant === "Search" && <Dot tone={TONES[i % 3] ?? ""} />}
                    {variant === "Steps" &&
                      (i < visible - 1 || !working ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.shrink}>
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <span className={styles.spinner} style={{ animation: "spin 700ms linear infinite" }} />
                      ))}
                    <span
                      className={clsx(styles.primary, variant === "Reasoning" ? styles.primaryReasoning : styles.primaryDefault, variant === "Search" && styles.animatedUnderline)}
                    >
                      {row.primary}
                    </span>
                    {row.secondary !== undefined && (
                      <span className={clsx(styles.secondary, row.mono === true && styles.mono)}>{row.secondary}</span>
                    )}
                    {row.add !== undefined && (
                      <span className={styles.diff}>
                        <span className={styles.add}>+{row.add}</span>{" "}
                        <span className={styles.del}>−{row.del}</span>
                      </span>
                    )}
                  </>
                );
                const animation = { animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${String(i * 120)}ms both` };

                if (variant === "Search") {
                  return (
                    <a
                      key={row.primary}
                      href={row.href}
                      target="_blank"
                      rel="noreferrer"
                      className={clsx(styles.rowBase, styles.rowHover)}
                      style={animation}
                    >
                      {content}
                    </a>
                  );
                }

                if (variant === "Coding") {
                  const selected = selectedTool === row.primary;
                  return (
                    <button
                      key={row.primary}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => { setSelectedTool(selected ? null : row.primary); }}
                      className={clsx(styles.rowBase, selected ? styles.rowSelected : styles.rowHover)}
                      style={animation}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div key={row.primary} className={styles.rowBase} style={animation}>
                    {content}
                  </div>
                );
              })}
              {variant === "Search" && stage >= 3 && (
                <span className={styles.more} style={{ animation: "fade-in 300ms ease-out both" }}>
                  +7 more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
