import { type JSX, useRef, useState } from "react";
import { GlideMenu } from "../../primitives";
import styles from "./FineTuneCard.module.css";

// FineTuneCard — beautifului. A compact property inspector: a segmented layout
// control, four scrub fields (drag or type), and a type dropdown. Editing any
// value flips the header from a shimmering "Adjust" to a green "Edited". Ported
// verbatim from source; Tailwind → CSS Modules over DSH vars.

interface ScrubFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  active?: boolean;
}

function ScrubField({ label, value, onChange, min, max, step = 1, suffix = "", active }: ScrubFieldProps): JSX.Element {
  const drag = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  return (
    <label
      className={styles.field}
      style={{
        background: active === true ? "var(--accent-tint)" : "var(--field)",
        boxShadow: active === true ? "0 0 0 1px var(--accent)" : "none",
      }}
    >
      {/* scrub handle */}
      <span
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, v: value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onChange(clamp(drag.current.v + ((e.clientX - drag.current.x) / 2) * step));
        }}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          const mult = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onChange(clamp(value + step * mult));
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onChange(clamp(value - step * mult));
          }
        }}
        className={styles.handle}
      >
        {label}
      </span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d-]/g, ""));
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        aria-label={`${label} value`}
        className={styles.input}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </label>
  );
}

const SEGMENTS = ["row", "col", "grid"] as const;

function SegmentIcon({ kind }: { kind: string }): JSX.Element {
  if (kind === "row")
    return <span className={styles.segRow}>{[0, 1, 2].map((i) => <span key={i} className={styles.dot} />)}</span>;
  if (kind === "col")
    return <span className={styles.segCol}>{[0, 1].map((i) => <span key={i} className={styles.dot} />)}</span>;
  return (
    <span className={styles.segGrid}>
      {[0, 1, 2, 3].map((i) => <span key={i} className={styles.dot} />)}
    </span>
  );
}

export interface FineTuneCardProps {
  /** override the initial selected layout segment index (0=row, 1=col, 2=grid) */
  initialSegment?: number;
}

export function FineTuneCard({ initialSegment = 0 }: FineTuneCardProps): JSX.Element {
  const [seg, setSeg] = useState(initialSegment);
  const [width, setWidth] = useState(324);
  const [height, setHeight] = useState(96);
  const [radius, setRadius] = useState(28);
  const [opacity, setOpacity] = useState(100);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typeValue, setTypeValue] = useState("Select type");
  const done =
    seg !== 0 || width !== 324 || height !== 96 || radius !== 28 || opacity !== 100 || typeValue !== "Select type";

  return (
    <div className={styles.card}>
      {/* header */}
      <div className={styles.bar}>
        <span className={styles.title}>Flavor card</span>
        {done ? (
          <span className={styles.edited} style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Edited
          </span>
        ) : (
          <span className={styles.adjustWrap}>
            <span className={styles.sparkBadge}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--accent)">
                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
              </svg>
            </span>
            <span
              className={styles.adjust}
              style={{
                backgroundImage: "linear-gradient(90deg, var(--accent) 35%, var(--accent-ink) 50%, var(--accent) 65%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-text 1.4s linear infinite",
              }}
            >
              Adjust
            </span>
          </span>
        )}
      </div>

      {/* layout section */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Layout</p>
        {/* segmented control: gray track, raised white thumb */}
        <div className={styles.segTrack}>
          <span
            aria-hidden
            className={styles.segThumb}
            style={{
              width: "calc((100% - 4px) / 3)",
              left: 2,
              transform: `translateX(${String(seg * 100)}%)`,
            }}
          />
          {SEGMENTS.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-label={`${s} layout`}
              aria-pressed={i === seg}
              onClick={() => { setSeg(i); }}
              className={i === seg ? styles.segBtnActive : styles.segBtn}
            >
              <SegmentIcon kind={s} />
            </button>
          ))}
        </div>
        <div className={styles.grid2}>
          <ScrubField label="W" value={width} onChange={setWidth} min={40} max={999} active={width !== 324} />
          <ScrubField label="H" value={height} onChange={setHeight} min={24} max={999} active={height !== 96} />
        </div>
        <div className={styles.grid2}>
          <ScrubField label="Radius" value={radius} onChange={setRadius} min={0} max={64} active={radius !== 28} />
          <ScrubField label="Opacity" value={opacity} onChange={setOpacity} min={0} max={100} suffix="%" active={opacity !== 100} />
        </div>
      </div>

      {/* interaction section */}
      <div className={styles.footer}>
        <span className={styles.typeLabel}>Type</span>
        <div className={styles.picker}>
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen((current) => !current); }}
            className={styles.pickerBtn}
            style={{ boxShadow: menuOpen ? "0 0 0 1px var(--accent)" : undefined }}
          >
            <span className={typeValue !== "Select type" ? styles.pickerValue : styles.pickerPlaceholder}>
              {typeValue}
            </span>
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={styles.chevron}
              style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0)" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className={styles.menu}
              style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom right" }}
            >
              <GlideMenu className={styles.menuList} highlightClassName={styles.menuHighlight}>
                {["Seasonal", "Classic", "Limited"].map((item) => (
                  <button
                    key={item}
                    data-glide-item
                    type="button"
                    onClick={() => {
                      setTypeValue(item);
                      setMenuOpen(false);
                    }}
                    className={item === typeValue ? styles.menuRowActive : styles.menuRow}
                  >
                    {item}
                  </button>
                ))}
              </GlideMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
