import clsx from "clsx";
import { type JSX,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button, GlideMenu } from "../../primitives";
import styles from "./ApprovalCard.module.css";

// ApprovalCard — beautifului. A single-card question flow: each question is the
// heading, options glide-highlight on hover, radios auto-advance, checks are
// multi-select, and a free-text "Something else…" is always available. The card
// height animates between questions and the step counter rolls like an odometer.
// Ported verbatim from the real source; Tailwind → CSS Modules over DSH vars.

interface Question {
  q: string;
  type: "radio" | "check";
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    q: "How many flavors should we launch?",
    type: "radio",
    options: ["Three (core line)", "Five (full case)", "Just one hero"],
  },
  {
    q: "Which mix-ins should we stock?",
    type: "check",
    options: ["Chocolate chips", "Waffle bits", "Sprinkles"],
  },
  {
    q: "Which market do we enter first?",
    type: "radio",
    options: ["Food trucks", "Grocery freezers", "Scoop shops"],
  },
];

const ROLL_MS = 400;
const SLIDE = "360ms cubic-bezier(0.22, 1, 0.36, 1)";

/* odometer digits — each character that changes rolls up (or down) */
function RollingDigits({ value }: { value: string }): JSX.Element {
  const prevRef = useRef(value);
  const [oldVal, setOldVal] = useState(value);
  const [newVal, setNewVal] = useState(value);
  const [rolling, setRolling] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");

  useEffect(() => {
    if (prevRef.current === value) return;
    const from = prevRef.current;
    prevRef.current = value;
    const fromN = parseInt(from, 10);
    const toN = parseInt(value, 10);
    setDir(Number.isFinite(fromN) && Number.isFinite(toN) && toN < fromN ? "down" : "up");
    setOldVal(from);
    setNewVal(value);
    setRolling(true);
    setShifted(false);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => { setShifted(true); });
    });
    const done = setTimeout(() => {
      setRolling(false);
      setOldVal(value);
      setShifted(false);
    }, ROLL_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [value]);

  const chars = rolling ? newVal : oldVal;

  return (
    <>
      {Array.from({ length: chars.length }, (_, i) => {
        const o = oldVal[i] ?? "";
        const n = chars[i] ?? "";
        if (!rolling || o === n) {
          return <span key={`${String(i)}-${n}`}>{n}</span>;
        }
        const top = dir === "down" ? n : o;
        const bottom = dir === "down" ? o : n;
        const restY = dir === "down" ? "0" : "-1em";
        const startY = dir === "down" ? "-1em" : "0";
        return (
          <span
            key={`${String(i)}-${o}-${n}-${dir}`}
            style={{
              display: "inline-block",
              position: "relative",
              overflow: "hidden",
              height: "1em",
              lineHeight: "1em",
              verticalAlign: "-0.05em",
            }}
          >
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                transition: "transform 350ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: `translateY(${shifted ? restY : startY})`,
              }}
            >
              <span style={{ height: "1em", lineHeight: "1em" }}>{top}</span>
              <span style={{ height: "1em", lineHeight: "1em" }}>{bottom}</span>
            </span>
          </span>
        );
      })}
    </>
  );
}

function Ico({ path, size = 14, sw = 2 }: { path: ReactNode; size?: number; sw?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
}

export interface ApprovalCardProps {
  onSubmitted?: () => void;
  resettable?: boolean;
  variant?: string;
}

export function ApprovalCard({ onSubmitted, resettable = true }: ApprovalCardProps = {}): JSX.Element {
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(true);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measured = useRef(false);
  const [viewportH, setViewportH] = useState<number | undefined>(undefined);
  const [trackY, setTrackY] = useState(0);
  const [animate, setAnimate] = useState(false);
  // Until the first question is measured, render only the active one so the
  // initial (and SSR) height is Q1's height — not all questions stacked, which
  // would flash to full height and then shrink on mount.
  const [ready, setReady] = useState(false);

  const last = qi === QUESTIONS.length - 1;
  const selected = answers[qi] ?? [];
  const hasAnswer = selected.length > 0 || Boolean(custom[qi]?.trim());

  const sync = (withAnim: boolean) => {
    const item = questionRefs.current[qi];
    if (!item) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setViewportH(item.offsetHeight);
    setTrackY(item.offsetTop);
    setAnimate(withAnim && !reduce);
  };

  useLayoutEffect(() => {
    const withAnim = measured.current;
    measured.current = true;
    sync(withAnim);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, answers, custom, open, sent]);

  useEffect(() => {
    const id = requestAnimationFrame(() => { sync(measured.current); });
    return () => { cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setQi(Math.min(Math.max(next, 0), QUESTIONS.length - 1));
  };

  const send = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setSent(true);
    onSubmitted?.();
  };

  const advance = () => {
    if (last) send();
    else goTo(qi + 1);
  };

  const toggle = (index: number) => {
    const current = QUESTIONS[qi];
    if (!current) return;
    const type = current.type;
    setAnswers((state) => {
      const picked = state[qi] ?? [];
      const next =
        type === "radio"
          ? [index]
          : picked.includes(index)
            ? picked.filter((item) => item !== index)
            : [...picked, index];
      return { ...state, [qi]: next };
    });
    if (type === "radio") {
      setCustom((state) => ({ ...state, [qi]: "" }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        if (last) send();
        else setQi((value) => Math.min(QUESTIONS.length - 1, value + 1));
      }, 480);
    }
  };

  const reset = () => {
    setQi(0);
    setAnswers({});
    setCustom({});
    setSent(false);
    setOpen(true);
    measured.current = false;
  };

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); }} className={styles.reopen}>
        Open approval
      </button>
    );
  }

  if (sent) {
    return (
      <div className={styles.sentRow} style={{ animation: "pop-in 260ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <span className={styles.sentPill}>
          <span className={styles.sentCheck}>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          Answers sent
        </span>
        {resettable && (
          <button type="button" onClick={reset} className={styles.startOver}>
            Start over
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.outer}>
      <div className={styles.card} style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <button type="button" aria-label="Dismiss" onClick={() => { setOpen(false); }} className={styles.dismiss}>
          <Ico size={14} sw={2.2} path={<path d="M18 6L6 18M6 6l12 12" />} />
        </button>
        <div className={styles.pad}>
          {/* the question itself is the heading */}
          <div
            className={styles.viewport}
            style={{ height: viewportH, transition: animate ? `height ${SLIDE}` : undefined }}
            aria-live="polite"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 26,
                transform: `translate3d(0, ${String(-trackY)}px, 0)`,
                transition: animate ? `transform ${SLIDE}` : undefined,
                willChange: "transform",
              }}
            >
              {QUESTIONS.map((question, qIdx) => {
                const active = qIdx === qi;
                // Before the first measure, mount only the active question so the
                // card opens at its real height instead of flashing to full height.
                if (!ready && !active) return null;
                const picked = answers[qIdx] ?? [];
                const questionStyle: CSSProperties = {
                  opacity: active ? 1 : 0,
                  transition: animate ? `opacity ${SLIDE}` : undefined,
                  pointerEvents: active ? undefined : "none",
                };
                return (
                  <div
                    key={qIdx}
                    ref={(el) => {
                      questionRefs.current[qIdx] = el;
                    }}
                    aria-hidden={active ? undefined : true}
                    style={questionStyle}
                  >
                    <div className={styles.questionText}>{question.q}</div>
                    <GlideMenu className={styles.menu} highlightClassName={styles.menuHighlight}>
                      {question.options.map((option, i) => {
                        const on = picked.includes(i);
                        return (
                          <button
                            key={option}
                            type="button"
                            data-glide-item
                            aria-pressed={on}
                            tabIndex={active ? 0 : -1}
                            onClick={() => {
                              if (active) toggle(i);
                            }}
                            className={styles.optionRow}
                          >
                            <span
                              className={clsx(
                                styles.indicator,
                                question.type === "radio" ? styles.indicatorRound : styles.indicatorSquare,
                                on ? styles.indicatorOn : styles.indicatorOff,
                              )}
                            >
                              {question.type === "radio" ? (
                                <span
                                  className={styles.radioDot}
                                  style={{ transform: on ? "scale(1)" : "scale(0)" }}
                                />
                              ) : (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              )}
                            </span>
                            <span className={clsx(styles.optionLabel, on ? styles.optionLabelOn : styles.optionLabelOff)}>
                              {option}
                            </span>
                          </button>
                        );
                      })}
                      <label data-glide-item className={styles.customRow}>
                        <input
                          value={custom[qIdx] ?? ""}
                          tabIndex={active ? 0 : -1}
                          onChange={(event) => {
                            if (!active) return;
                            setCustom((state) => ({ ...state, [qIdx]: event.target.value }));
                            if (question.type === "radio") setAnswers((state) => ({ ...state, [qIdx]: [] }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && hasAnswer) {
                              event.preventDefault();
                              advance();
                            }
                          }}
                          placeholder="Something else…"
                          aria-label="Custom answer"
                          className={styles.customInput}
                        />
                      </label>
                    </GlideMenu>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer — step nav (rolling counter) + pill actions */}
        <div className={styles.footer}>
          <div className={styles.stepNav}>
            <button
              type="button"
              aria-label="Previous question"
              disabled={qi <= 0}
              onClick={() => { goTo(qi - 1); }}
              className={styles.navBtn}
            >
              <Ico size={14} path={<path d="M18 15l-6-6-6 6" />} />
            </button>
            <span className={styles.counter} style={{ letterSpacing: "-0.1px", lineHeight: 1 }}>
              <RollingDigits value={`${String(qi + 1)} / ${String(QUESTIONS.length)}`} />
            </span>
            <button
              type="button"
              aria-label="Next question"
              disabled={last}
              onClick={() => { goTo(qi + 1); }}
              className={styles.navBtn}
            >
              <Ico size={14} path={<path d="M6 9l6 6 6-6" />} />
            </button>
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={() => { if (last) setOpen(false); else goTo(qi + 1); }}>
              Skip
            </Button>
            <Button variant="accent" size="sm" disabled={!hasAnswer} onClick={advance}>
              {last ? "Send" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
