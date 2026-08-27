import { type JSX,
  type SVGProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Shimmer, StreamText } from "../../primitives";
import styles from "./SelectionActions.module.css";

// SelectionActions — beautifului. A floating action bar that attaches beneath a
// text selection: idle presets (Explain/Improve/…) expand and collapse, a free
// text prompt slides in, and running an action streams a rewrite in place before
// resolving to Keep/Discard/Retry. The bar re-measures and re-centers on every
// reflow. Ported verbatim from the real source; Tailwind → CSS Modules over DSH
// vars; the width/position choreography (Web Animations + rAF) is the real one.

const LEAD = "Pistachio holds the top slot all weekend. ";
const PICKED =
  "Churn it first thing Saturday so the batch has time to firm up before the afternoon rush.";
const REWRITE =
  "Churn pistachio first thing Saturday so the batch has time to fully firm before the afternoon rush.";

type Mode = "idle" | "thinking" | "streaming" | "result";

// ── inline iconoir icons (path data inlined from the icon set) ──
function ChatBubbleQuestion(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 9C9 5.49997 14.5 5.5 14.5 9C14.5 11.5 12 10.9999 12 13.9999" />
      <path d="M12 18.01L12.01 17.9989" />
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" />
    </svg>
  );
}

function Spark(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinejoin="round" {...props}>
      <path d="M3 12C9.26752 12 12 9.36306 12 3C12 9.36306 14.7134 12 21 12C14.7134 12 12 14.7134 12 21C12 14.7134 9.26752 12 3 12Z" />
    </svg>
  );
}

function Scissor(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.23611 7C7.71115 6.46924 8 5.76835 8 5C8 3.34315 6.65685 2 5 2C3.34315 2 2 3.34315 2 5C2 6.65685 3.34315 8 5 8C5.8885 8 6.68679 7.61375 7.23611 7ZM7.23611 7L20 18" />
      <path d="M7.23611 17C7.71115 17.5308 8 18.2316 8 19C8 20.6569 6.65685 22 5 22C3.34315 22 2 20.6569 2 19C2 17.3431 3.34315 16 5 16C5.8885 16 6.68679 16.3863 7.23611 17ZM7.23611 17L20 6" />
    </svg>
  );
}

function EmojiSatisfied(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 9H8M16 9H14M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12Z" />
      <path d="M16.5 14.5C16.5 14.5 15 16.5 12 16.5C9 16.5 7.5 14.5 7.5 14.5" />
    </svg>
  );
}

function TextBox(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 8L12 16M12 8H8M12 8H16" />
      <path d="M21 13.5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13.5M21 10.5V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V10.5" />
      <path d="M19.5 13.5V10.5H22.5V13.5H19.5Z" />
      <path d="M1.5 13.5V10.5H4.5V13.5H1.5Z" />
    </svg>
  );
}

function ArrowUp(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21L12 3M12 3L20.5 11.5M12 3L3.5 11.5" />
    </svg>
  );
}

function NavArrowRight(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 6L15 12L9 18" />
    </svg>
  );
}

function Check(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 13L9 17L19 7" />
    </svg>
  );
}

function Xmark(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426" />
    </svg>
  );
}

function Refresh(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.8883 13.5C21.1645 18.3113 17.013 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C16.1006 2 19.6248 4.46819 21.1679 8" />
      <path d="M17 8H21.4C21.7314 8 22 7.73137 22 7.4V3" />
    </svg>
  );
}

const iconProps = {
  width: 14,
  height: 14,
  strokeWidth: 1.8,
  "aria-hidden": true,
} as const;

const icons = {
  explain: <ChatBubbleQuestion {...iconProps} />,
  improve: <Spark {...iconProps} />,
  shorten: <Scissor {...iconProps} />,
  tone: <EmojiSatisfied {...iconProps} />,
  grammar: <TextBox {...iconProps} />,
  send: <ArrowUp width="16" height="16" strokeWidth="2.4" aria-hidden="true" />,
  chevron: <NavArrowRight {...iconProps} />,
  check: <Check {...iconProps} />,
  close: <Xmark {...iconProps} />,
  retry: <Refresh {...iconProps} />,
};

export function SelectionActions(): JSX.Element {
  const [shown, setShown] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [action, setAction] = useState("Improve");
  const [prompt, setPrompt] = useState("");
  const [typingWidth, setTypingWidth] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [positioned, setPositioned] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const previousModeRef = useRef<Mode>("idle");
  const lastWidthRef = useRef(0);
  const widthAnimationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setShown(true); }, 280);
    return () => { window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (mode !== "thinking") return;
    const timer = window.setTimeout(() => { setMode("streaming"); }, 700);
    return () => { window.clearTimeout(timer); };
  }, [mode]);

  /* Attach beneath the final selected line, while centering the bar
   * against the complete selection bounds. requestAnimationFrame batches
   * streaming reflow measurements and avoids visible intermediate positions. */
  const place = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const host = hostRef.current;
      const selection = selectionRef.current;
      if (!host || !selection) return;

      const bounds = selection.getBoundingClientRect();
      const lines = Array.from(selection.getClientRects());
      const lastLine = lines.at(-1);
      if (!lastLine) return;

      const hostBounds = host.getBoundingClientRect();
      const next = {
        x: Math.round(bounds.left - hostBounds.left + bounds.width / 2),
        y: Math.round(lastLine.bottom - hostBounds.top + 8),
      };

      setAnchor((current) => (current.x === next.x && current.y === next.y ? current : next));
      setPositioned(true);
    });
  }, []);

  useLayoutEffect(() => {
    place();
  }, [mode, place]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(place);
    observer.observe(host);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [place]);

  /* Intrinsic width handles the preset expansion. When the entire content
   * changes between idle, loading and confirmation, animate from the last
   * rendered width to the new intrinsic width before the browser paints. */
  useLayoutEffect(() => {
    const bar = barRef.current;
    const content = contentRef.current;
    if (!bar || !content) return;

    const nextWidth = Math.ceil(content.getBoundingClientRect().width) + 8;
    const previousWidth = lastWidthRef.current || Math.ceil(bar.getBoundingClientRect().width);

    if (previousModeRef.current !== mode && Math.abs(nextWidth - previousWidth) > 1) {
      widthAnimationRef.current?.cancel();
      const animation = bar.animate([{ width: `${String(previousWidth)}px` }, { width: `${String(nextWidth)}px` }], {
        duration: 320,
        easing: "cubic-bezier(0.23,1,0.32,1)",
      });
      widthAnimationRef.current = animation;
      animation.onfinish = () => {
        lastWidthRef.current = nextWidth;
        widthAnimationRef.current = null;
      };
    } else {
      lastWidthRef.current = nextWidth;
    }

    previousModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (widthAnimationRef.current?.playState === "running") return;
      lastWidthRef.current = Math.ceil(content.getBoundingClientRect().width) + 8;
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      widthAnimationRef.current?.cancel();
    };
  }, []);

  const run = (nextAction: string) => {
    setAction(nextAction);
    setExpanded(false);
    setMode("thinking");
  };

  const reset = () => {
    setExpanded(false);
    setPrompt("");
    setTypingWidth(null);
    setAction("Improve");
    setMode("idle");
  };

  const busy = mode === "thinking" || mode === "streaming";
  const visible = shown && positioned;
  const hasPrompt = prompt.trim().length > 0;
  const busyLabel =
    action === "Improve"
      ? "Improving"
      : action === "Shorten"
        ? "Shortening"
        : action === "Change tone"
          ? "Changing tone"
          : "Editing";

  return (
    <div className={styles.root}>
      <div ref={hostRef} className={styles.host}>
        <p className={styles.paragraph}>
          {LEAD}
          <span ref={selectionRef} className={styles.selection}>
            {mode === "idle" || mode === "thinking" ? (
              PICKED
            ) : mode === "streaming" ? (
              <StreamText text={REWRITE} onProgress={place} onDone={() => { setMode("result"); }} />
            ) : (
              REWRITE
            )}
          </span>
        </p>

        <div
          className={styles.anchor}
          style={{
            transform: `translate3d(${String(anchor.x)}px, ${String(anchor.y)}px, 0) translateX(-50%)`,
            transition: "transform 320ms cubic-bezier(0.77,0,0.175,1), opacity 180ms ease-out",
            opacity: visible ? 1 : 0,
            pointerEvents: visible ? "auto" : "none",
            willChange: "transform",
          }}
        >
          {/* A 36px pill wraps 28px controls at a 4px inset. The controls
              resolve to a 14px radius, preserving the concentric curve. */}
          <div
            ref={barRef}
            className={styles.bar}
            style={{
              width: mode === "idle" && hasPrompt && typingWidth !== null ? typingWidth : undefined,
              ...(visible ? { animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" } : {}),
            }}
          >
            <div
              ref={contentRef}
              className={styles.content}
              style={{
                width: mode === "idle" && hasPrompt && typingWidth !== null ? typingWidth - 8 : undefined,
              }}
            >
              {busy && (
                <span className={styles.busy}>
                  <span className={styles.spinner} style={{ animation: "spin 700ms linear infinite" }} />
                  {mode === "thinking" ? (
                    <Shimmer className={styles.busyLabel}>{busyLabel}…</Shimmer>
                  ) : (
                    <span>{busyLabel}…</span>
                  )}
                </span>
              )}

              {mode === "result" && (
                <>
                  <button type="button" onClick={reset} className={styles.primary}>
                    {icons.check}
                    Keep
                  </button>
                  <button type="button" onClick={reset} className={styles.control}>
                    {icons.close}
                    Discard
                  </button>
                  <span className={styles.divider} />
                  <button
                    type="button"
                    aria-label="Try again"
                    onClick={() => { run(action); }}
                    className={styles.retryBtn}
                  >
                    {icons.retry}
                  </button>
                </>
              )}

              {mode === "idle" && (
                <>
                  <div
                    className={styles.promptClip}
                    style={{
                      maxWidth: expanded ? 0 : hasPrompt && typingWidth !== null ? typingWidth - 40 : 145,
                      opacity: expanded ? 0 : 1,
                      transform: expanded ? "translateX(-8px)" : "translateX(0)",
                      transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                    }}
                  >
                    <form
                      className={styles.promptForm}
                      style={{
                        width: hasPrompt && typingWidth !== null ? typingWidth - 40 : 145,
                        transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                      }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        run(prompt.trim() || "Improve");
                      }}
                    >
                      <input
                        value={prompt}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (!prompt.trim() && next.trim()) {
                            setTypingWidth(Math.ceil(barRef.current?.getBoundingClientRect().width ?? 0));
                          } else if (!next.trim()) {
                            setTypingWidth(null);
                          }
                          setPrompt(next);
                        }}
                        aria-label="Describe edits"
                        placeholder="Describe edits"
                        className={styles.promptInput}
                      />
                    </form>
                  </div>

                  <div
                    className={styles.presets}
                    style={{
                      maxWidth: hasPrompt ? 0 : expanded ? 462 : 224,
                      opacity: hasPrompt ? 0 : 1,
                      transform: hasPrompt ? "translateX(-8px)" : "translateX(0)",
                      transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                    }}
                  >
                    {!expanded && <span className={styles.dividerStrong} />}
                    <button type="button" className={styles.control}>
                      {icons.explain}
                      Explain
                    </button>
                    <button type="button" onClick={() => { run("Improve"); }} className={styles.control}>
                      {icons.improve}
                      Improve
                    </button>

                    <div
                      className={styles.moreClip}
                      style={{
                        maxWidth: expanded ? 262 : 0,
                        opacity: expanded ? 1 : 0,
                        marginLeft: expanded ? 2 : 0,
                        transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                      }}
                    >
                      <button type="button" onClick={() => { run("Shorten"); }} className={styles.control}>
                        {icons.shorten}
                        Shorten
                      </button>
                      <button type="button" onClick={() => { run("Change tone"); }} className={styles.control}>
                        {icons.tone}
                        Tone
                      </button>
                      <button type="button" onClick={() => { run("Fix grammar"); }} className={styles.control}>
                        {icons.grammar}
                        Grammar
                      </button>
                    </div>

                    <span className={styles.divider} />
                    <button
                      type="button"
                      aria-label={expanded ? "Show fewer actions" : "Show more actions"}
                      aria-expanded={expanded}
                      onClick={() => { setExpanded((value) => !value); }}
                      className={styles.chevronBtn}
                    >
                      <span
                        className={styles.chevronInner}
                        style={{
                          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                          transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                        }}
                      >
                        {icons.chevron}
                      </span>
                    </button>
                  </div>

                  <div
                    className={styles.sendClip}
                    style={{
                      maxWidth: hasPrompt ? 30 : 0,
                      opacity: hasPrompt ? 1 : 0,
                      transform: hasPrompt ? "scale(1)" : "scale(0.88)",
                      transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Send edit instruction"
                      onClick={() => { run(prompt.trim()); }}
                      className={styles.sendBtn}
                    >
                      {icons.send}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
