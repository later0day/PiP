import { type JSX, useState } from "react";
import { useElapsed } from "../../hooks";
import { Shimmer } from "../../primitives";
import { lookup } from "../../lib/lookup";
import styles from "./LoadingState.module.css";

// LoadingState — beautifului #1. A 3×3 pixel-loader with a shimmering label and
// live elapsed clock; five variants (Drive/Orbit/Rain/Pulse churning grids +
// Surfer meme-video card). Ported verbatim from the real source; Tailwind →
// CSS Modules over DSH vars; the PATTERNS choreography is the real one.

// 3×3 pixel-loader choreographies. Each `delays` has 9 entries (row-major);
// null = the pixel stays dim, a number = its pixel-on animation delay (ms).
// dur = one pulse cycle; round = dots vs squares.
interface Pattern {
  delays: (number | null)[];
  dur: number;
  round: boolean;
}

const PATTERNS = {
  // diagonal sweep — the default "churning" wave
  Drive: {
    delays: [0, 120, 240, 120, 240, 360, 240, 360, 480],
    dur: 1200,
    round: false,
  },
  // orbiting ring, hollow centre
  Orbit: {
    delays: [0, 100, 200, 700, null, 300, 600, 500, 400],
    dur: 1400,
    round: true,
  },
  // top-to-bottom rain
  Rain: {
    delays: [0, 200, 400, 150, 350, 550, 300, 500, 700],
    dur: 1100,
    round: false,
  },
  // gentle centre pulse
  Pulse: {
    delays: [200, 100, 200, 100, 0, 100, 200, 100, 200],
    dur: 1300,
    round: true,
  },
} satisfies Record<string, Pattern>;

function LoaderGrid({ delays, dur, round }: Pattern): JSX.Element {
  return (
    <span aria-hidden className={styles.grid}>
      {delays.map((delay, index) => (
        <span
          key={index}
          className={round ? styles.pixelRound : styles.pixelSquare}
          style={{
            opacity: delay === null ? 0.07 : 0.15,
            animation: delay === null ? "none" : `pixel-on ${String(dur)}ms ease-in-out ${String(delay)}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

export interface LoadingStateProps {
  label?: string;
  variant?: string;
  /** the meme feed for the Surfer variant; drop the file in /public to light it up */
  videoSrc?: string;
}

export function LoadingState({ label, variant = "Drive", videoSrc = "/subway-surfers.mp4" }: LoadingStateProps): JSX.Element {
  const elapsed = useElapsed();
  const surfer = variant === "Surfer";
  const resolvedLabel = label ?? (surfer ? "Subway surfing" : "Churning");
  const [videoOk, setVideoOk] = useState(true);
  const { delays, dur, round } = lookup(PATTERNS, variant) ?? PATTERNS.Drive;

  const labelEl = <Shimmer className={styles.label}>{resolvedLabel}</Shimmer>;
  const elapsedEl = <span className={styles.elapsed}>{elapsed}</span>;

  if (surfer) {
    return (
      <div role="status" className={styles.surferCol}>
        <div className={styles.row}>
          <LoaderGrid {...PATTERNS.Drive} />
          {labelEl}
          {elapsedEl}
        </div>

        {/* the context card follows the status text it is illustrating */}
        <div className={styles.card}>
          <div className={styles.videoWrap}>
            {videoOk ? (
              <video
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onError={() => { setVideoOk(false); }}
                className={styles.video}
              />
            ) : (
              <div className={styles.videoFallback}>
                <LoaderGrid {...PATTERNS.Drive} />
                <span className={styles.videoMuted}>Video unavailable</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className={styles.row}>
      <LoaderGrid delays={delays} dur={dur} round={round} />
      {labelEl}
      {elapsedEl}
    </div>
  );
}
