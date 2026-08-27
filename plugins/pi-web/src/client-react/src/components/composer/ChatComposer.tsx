import clsx from "clsx";
import { type JSX, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ChatComposer.module.css";

// ChatComposer — beautifului. A self-contained chat card: tabbed header with
// action buttons, a fixed-height conversation region that plays a scripted
// reply sequence, and a composer input with a tactile send button. Ported
// verbatim from the real source; Tailwind → CSS Modules over DSH bridge vars.

// The reply choreography state machine. Starts resolved so the card shows a
// finished exchange, then re-runs sent → reply1 → reply2 → done on each send.
type Phase = "idle" | "sent" | "reply1" | "reply2" | "done";

interface SectionProps {
  label: string;
  sub: string;
  time: string;
  body: string;
  resolving?: boolean;
}

function Section({ label, sub, time, body, resolving }: SectionProps): JSX.Element {
  return (
    <div
      className={styles.section}
      style={{
        opacity: resolving === true ? 0.55 : 1,
        filter: resolving === true ? "blur(0.5px)" : "blur(0)",
        transform: resolving === true ? "scale(0.985)" : "scale(1)",
        transformOrigin: "top left",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        animation: "fade-up 400ms cubic-bezier(0.23,1,0.32,1) both",
      }}
    >
      <div className={styles.sectionHead}>
        <span className={styles.sectionLabel}>{label}</span>
        <span className={styles.sectionSub}>{sub}</span>
        <span className={styles.sectionTime}>for {time}</span>
      </div>
      <p className={styles.sectionBody}>{body}</p>
    </div>
  );
}

// Header action-button glyphs (add / clock / ellipsis), inline so the file
// stays self-contained. Each entry is the inner markup of a shared 24×24 svg.
const ACTION_ICONS: ReactNode[] = [
  <path key="p" d="M12 5v14M5 12h14" />,
  <g key="h">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </g>,
  <g key="e" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </g>,
];

const TABS = ["Flavors", "Suppliers"] as const;

export interface ChatComposerProps {
  /** the message shown pre-populated in the user bubble */
  initialSubmitted?: string;
}

export function ChatComposer({
  initialSubmitted = "Compare mint chip to last summer",
}: ChatComposerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>("done");
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [tab, setTab] = useState<string>("Flavors");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "sent") t = setTimeout(() => { setPhase("reply1"); }, 500);
    else if (phase === "reply1") t = setTimeout(() => { setPhase("reply2"); }, 1400);
    else if (phase === "reply2") t = setTimeout(() => { setPhase("done"); }, 1200);
    else return;
    return () => { clearTimeout(t); };
  }, [phase]);

  const sent = phase !== "idle";
  const canSend = draft.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    setSubmitted(draft.trim());
    setDraft("");
    setPhase("sent");
  };

  return (
    <div className={styles.root}>
      {/* header — tabs + actions */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              onClick={() => { setTab(item); }}
              className={clsx(styles.tab, tab === item ? styles.tabActive : styles.tabIdle)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          {ACTION_ICONS.map((icon, i) => (
            <button key={i} type="button" aria-label="Action" className={styles.actionBtn}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* conversation — fixed region so the card never changes shape */}
      <div className={styles.convo}>
        {/* user bubble — right aligned, soft block */}
        <div className={styles.userRow}>
          <div
            className={styles.bubble}
            style={{
              opacity: sent ? 1 : 0,
              transform: sent ? "translateY(0)" : "translateY(10px)",
              transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            {submitted}
          </div>
        </div>

        {phase === "reply1" || phase === "reply2" || phase === "done" ? (
          <Section
            label="Sales History"
            sub="Flavor Data"
            time="4s"
            body="Pulled 3 summers of mint chip sales for comparison."
          />
        ) : null}
        {phase === "reply2" || phase === "done" ? (
          <Section
            label="Comparison"
            sub="Trend Detection"
            time="2s"
            body="Mint chip is up 12% with stronger weekend peaks."
            resolving={phase === "reply2"}
          />
        ) : null}
      </div>

      {/* composer */}
      <div className={styles.composerWrap}>
        <div role="presentation" onClick={() => inputRef.current?.focus()} className={styles.composerBox}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder="Prompt or tag a flavor with @"
            aria-label="Chat prompt"
            className={styles.input}
          />
          <div className={styles.sendRow}>
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              onClick={send}
              className={styles.sendBtn}
              style={{
                background: canSend ? "var(--ink)" : "var(--line-strong)",
                color: canSend ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
