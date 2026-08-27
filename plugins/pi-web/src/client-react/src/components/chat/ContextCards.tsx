import clsx from "clsx";
import type { JSX } from "react";
import { useStage } from "../../hooks";
import styles from "./ContextCards.module.css";

// ContextCards — beautifului retrieved-context chunks. A count header fades in,
// then chunk cards rise staggered; each card's source chip scales in on a
// shared-hook delay. Ported verbatim; Tailwind → CSS Modules over DSH vars.

interface Chunk {
  title: string;
  chars: string;
  body: string;
  source: string;
  badge: string;
  /** which DSH tone drives the badge square */
  tone: "green" | "red";
}

const CHUNKS: Chunk[] = [
  {
    title: "Vendor onboarding rule",
    chars: "290 characters",
    body: "Cold-chain certification must be verified before a new dairy can be added to the reorder workflow.",
    source: "Dairy Onboarding SOP.pdf",
    badge: "PDF",
    tone: "red",
  },
  {
    title: "Seasonal demand row",
    chars: "1,250 characters",
    body: "Q4 velocity table: pistachio +18%, vanilla +6%, rocky road -11%; retire flavors below 40 scoops weekly.",
    source: "Sales Velocity Export.csv",
    badge: "CSV",
    tone: "green",
  },
];

// single-step reveal: the source chips scale in once the 700ms stage lands
const CHIP_STAGES = [700];

export function ContextCards(): JSX.Element {
  const stage = useStage(CHIP_STAGES);
  const chipsShown = stage >= CHIP_STAGES.length;

  return (
    <div className={styles.root}>
      <div className={styles.head} style={{ animation: "fade-in 400ms ease-out both" }}>
        <span className={styles.headTitle}>All chunks</span>
        <span className={styles.headCount}>32</span>
      </div>

      {CHUNKS.map((chunk, i) => (
        <div key={chunk.title} className={styles.card} style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${String(i * 100)}ms both` }}>
          <div className={styles.cardBar}>
            <span className={styles.cardTitle}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              <span className={styles.cardTitleText}>{chunk.title}</span>
            </span>
            <span className={styles.cardChars}>{chunk.chars}</span>
          </div>
          <p className={styles.body}>{chunk.body}</p>
          <div className={styles.chipRow}>
            <span
              className={styles.sourceChip}
              style={{
                opacity: chipsShown ? 1 : 0,
                transform: chipsShown ? "scale(1)" : "scale(0.95)",
                transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                transitionDelay: `${String(i * 80)}ms`,
              }}
            >
              <span className={clsx(styles.badge, chunk.tone === "red" ? styles.badgeRed : styles.badgeGreen)}>{chunk.badge}</span>
              {chunk.source}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
