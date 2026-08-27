import { type JSX, useEffect, useState } from "react";
import type { ReactNode } from "react";
import styles from "./StreamingText.module.css";

// StreamingText — beautifului #3. Words resolve out of a cursor stream, an
// inline citation chip lands in context, then action icons, a sources sheet,
// and follow-up prompts become usable. Ported verbatim; Tailwind → CSS Modules
// over DSH vars; role/aria preserved.

const WORD_MS = 55;
const HOLD_MS = 3400;

interface Token {
  text: string;
  cite?: boolean;
}

const TOKENS: Token[] = [
  ..."开心果是增长最快的口味——本月销量上涨 23%，利润率比香草高 8 个百分点。"
    .split("")
    .map((text) => ({ text })),
  { text: "", cite: true },
  ..."同区间内核果类口味也在走高。".split("").map((text) => ({ text })),
];

const FOLLOW_UPS = ["冬季哪些口味卖得最好", "对比意式冰淇淋与软冰的利润率"];

const SOURCE_IMAGES = {
  scoop:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231f7a5f'/%3E%3Cpath d='M20 36c0 7 5.4 12 12 12s12-5 12-12H20Z' fill='%23fff'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23bff3dd'/%3E%3Cpath d='M24 24c4-7 13-7 17 0' fill='none' stroke='%231f7a5f' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
  trends:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%232f6fec'/%3E%3Cpath d='M15 43 27 31l8 7 14-18' fill='none' stroke='%23fff' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='49' cy='20' r='5' fill='%23bfe0ff'/%3E%3C/svg%3E",
  market:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23e56d24'/%3E%3Cpath d='M17 45V25h8v20h-8Zm11 0V16h8v29h-8Zm11 0V30h8v15h-8Z' fill='%23fff'/%3E%3Cpath d='M16 49h32' stroke='%23ffd6b8' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
} satisfies Record<string, string>;

interface Source {
  name: string;
  domain: string;
  href: string;
  image: string;
}

const SOURCES: Source[] = [
  { name: "冰淇淋数据", domain: "scoopdata.io", href: "https://scoopdata.io/", image: SOURCE_IMAGES.scoop },
  { name: "趋势指数", domain: "trends.google.com", href: "https://trends.google.com/trends/", image: SOURCE_IMAGES.trends },
  { name: "市场篮子", domain: "marketbasket.io", href: "https://marketbasket.io/", image: SOURCE_IMAGES.market },
];

function sourceImage(source: Source): string {
  return source.image;
}

function SourceChip(): JSX.Element {
  const source = SOURCES[0] ?? { name: "", domain: "", href: "#", image: "" };
  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      className={styles.chip}
      style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <img src={sourceImage(source)} alt="" className={styles.chipAvatar} />
      <span>{source.domain}</span>
    </a>
  );
}

const ACTION_ICONS: ReactNode[] = [
  <g key="copy">
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </g>,
  <path key="retry" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
  <path key="up" d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" />,
  <path key="down" d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z" />,
];

export interface StreamingTextProps {
  variant?: string;
  /** restart the stream after a hold; turn off when embedding in a real thread */
  loop?: boolean;
  /** fill the parent width instead of the gallery's fixed measure */
  fill?: boolean;
  onDone?: () => void;
}

export function StreamingText({ loop = true, fill = false, onDone }: StreamingTextProps): JSX.Element {
  const [count, setCount] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const done = count >= TOKENS.length;

  useEffect(() => {
    if (done && !loop) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => { setCount((c) => (c >= TOKENS.length ? 0 : c + 1)); }, done ? HOLD_MS : WORD_MS);
    return () => { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done, loop]);

  return (
    <div className={fill ? styles.rootFill : styles.root}>
      <p className={styles.prose}>
        {TOKENS.slice(0, count).map((token, i) =>
          token.cite === true ? (
            <SourceChip key={i} />
          ) : (
            <span key={i} className={styles.word}>
              {token.text}
            </span>
          ),
        )}
        {!done && <span className={styles.cursor} style={{ animation: "fade-in 150ms ease-out both" }} />}
      </p>

      {/* action icons row */}
      <div
        className={styles.actions}
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        {ACTION_ICONS.map((icon, i) => (
          <button key={i} type="button" aria-label="操作" className={styles.actionBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </button>
        ))}
        <button type="button" aria-expanded={sourcesOpen} onClick={() => { setSourcesOpen((current) => !current); }} className={styles.sourcesBtn}>
          <span className={styles.avatarStack}>
            {SOURCES.map((source) => (
              <img key={source.domain} src={sourceImage(source)} alt="" className={styles.stackAvatar} />
            ))}
          </span>
          <span className={styles.sourcesLabel}>10 个来源</span>
        </button>
      </div>

      <div
        className={styles.sheetGrid}
        style={{
          gridTemplateRows: done && sourcesOpen ? "1fr" : "0fr",
          opacity: done && sourcesOpen ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className={styles.clip}>
          <div className={styles.sheet}>
            {SOURCES.map((source) => (
              <a key={source.domain} href={source.href} target="_blank" rel="noreferrer" className={styles.sheetRow}>
                <img src={sourceImage(source)} alt="" className={styles.sheetAvatar} />
                <span className={styles.animatedUnderline}>{source.name}</span>
                <span className={styles.sheetDomain}>{source.domain}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* follow-ups */}
      <div className={styles.followUps} style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}>
        <p className={styles.followTitle}>后续问题</p>
        <div className={styles.followList}>
          {FOLLOW_UPS.map((text, i) => (
            <button
              key={text}
              className={styles.followBtn}
              style={done ? { animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${String(i * 90)}ms both` } : { opacity: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.shrink}>
                <path d="M9 10l-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
