import { type JSX, useState } from "react";
import { Button, EntityChip, ValuePill } from "../../primitives";
import type { ButtonVariant } from "../../primitives";
import styles from "./RecommendationCard.module.css";

// RecommendationCard — beautifului. The card holds its shape; pressing
// "Alternatives" opens a drawer of the other options, and picking one promotes
// it to the recommendation. The primary action confirms. Ported verbatim from
// the real source; Tailwind → CSS Modules over DSH vars.

interface Option {
  key: string;
  body: React.ReactNode;
  short: string;
  signal: number;
  tone: string;
  label: string;
  cta: string;
  ctaVariant: ButtonVariant;
}

const OPTIONS: [Option, ...Option[]] = [
  {
    key: "high",
    body: (
      <>
        Reorder waffle cones from <EntityChip name="Cone King" /> with lead time{" "}
        <ValuePill tone="green">7 days</ValuePill>
      </>
    ),
    short: "Reorder from Cone King · 7-day lead",
    signal: 3,
    tone: "var(--green)",
    label: "High confidence",
    cta: "Accept",
    ctaVariant: "accent",
  },
  {
    key: "review",
    body: (
      <>
        Switch vanilla to <ValuePill>Vanilla Madagascar</ValuePill> for peak season.
      </>
    ),
    short: "Switch to Vanilla Madagascar",
    signal: 2,
    tone: "var(--orange)",
    label: "Needs review",
    cta: "Configure",
    ctaVariant: "primary",
  },
  {
    key: "none",
    body: (
      <>
        Fall back to a <span className={styles.strong}>full restock</span> across every SKU.
      </>
    ),
    short: "Full restock across every SKU",
    signal: 0,
    tone: "var(--ink-3)",
    label: "No signal",
    cta: "Accept full restock",
    ctaVariant: "primary",
  },
];

function Meter({ signal, tone }: { signal: number; tone: string }): JSX.Element {
  return (
    <span className={styles.meter}>
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={styles.meterBar}
          style={{ background: bar < signal ? tone : "var(--line-strong)" }}
        />
      ))}
    </span>
  );
}

export interface RecommendationCardProps {
  /** override the starting recommendation index */
  initial?: number;
}

export function RecommendationCard({ initial = 0 }: RecommendationCardProps): JSX.Element {
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const active = OPTIONS[selected] ?? OPTIONS[0];
  const others = OPTIONS.map((o, i) => ({ o, i })).filter(({ i }) => i !== selected);

  return (
    <div className={styles.card}>
      <div className={styles.pad}>
        <span className={styles.question}>Want me to place this restock order?</span>
        <p key={active.key} className={styles.body} style={{ animation: "fade-in 180ms ease-out both" }}>
          {active.body}
        </p>
      </div>

      {/* alternatives drawer — a distinctly new section of the card */}
      <div
        className={styles.drawer}
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
      >
        <div className={styles.drawerClip}>
          <div className={styles.drawerInner}>
            <p className={styles.drawerLabel}>Other options</p>
            {others.map(({ o, i }) => (
              <button key={o.key} type="button" onClick={() => { setSelected(i); setAccepted(false); }} className={styles.optionRow}>
                <Meter signal={o.signal} tone={o.tone} />
                <span className={styles.optionShort}>{o.short}</span>
                <span className={styles.optionLabel}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerMeter}>
          <Meter signal={active.signal} tone={active.tone} />
          <span className={styles.footerLabel}>{active.label}</span>
        </span>

        <span className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => { setOpen((current) => !current); }}
            className={styles.altBtn}
          >
            Alternatives
          </Button>
          <Button
            variant={accepted ? "success" : active.ctaVariant}
            size="sm"
            onClick={() => { setAccepted(true); }}
            className={styles.ctaBtn}
          >
            {accepted ? "Accepted" : active.cta}
          </Button>
        </span>
      </div>
    </div>
  );
}
