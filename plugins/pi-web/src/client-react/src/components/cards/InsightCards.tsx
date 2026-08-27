import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lookup } from "../../lib/lookup";
import styles from "./InsightCards.module.css";

// InsightCards — beautifului. A 3-page insight pager (return comparison /
// anomaly / allocation). The original drove its charts with the private
// `liveline` lib; here the charts are REAL inline SVG (no external lib): a
// two-series smoothed line chart (CompareCard) and a baseline-anchored bar
// chart (AnomalyCard), both driven by the source data arrays. AllocationCard is
// the source's HTML segmented bar. Tailwind → CSS Modules over DSH vars.

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const formatPercent = (v: number): string => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const formatMoney = (v: number): string => `$${Math.round(v).toLocaleString("en-US")}`;

interface Point {
  time: number;
  value: number;
}

/* anchor the snapshot to *call* time (inside each card's mount-time memo) — a
 * module-load constant goes stale. */
function makePoints(values: number[], gap = 6): Point[] {
  const end = Math.floor(Date.now() / 1000);
  return values.map((value, index) => ({
    time: end - (values.length - 1 - index) * gap,
    value,
  }));
}

/* Catmull-Rom resample — turn a sparse series into a dense, smoothly curved one
 * so both the line and the hover cursor glide instead of stepping. */
function smooth(values: number[], perSegment = 9): number[] {
  if (values.length < 3) return values.slice();
  const out: number[] = [];
  const n = values.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = values[Math.max(0, i - 1)] ?? 0;
    const p1 = values[i] ?? 0;
    const p2 = values[i + 1] ?? 0;
    const p3 = values[Math.min(n - 1, i + 2)] ?? 0;
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        0.5 *
          (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3),
      );
    }
  }
  out.push(values[n - 1] ?? 0);
  return out;
}

/* dense, smoothed points spanning exactly `spanSecs`. */
function smoothPoints(values: number[], spanSecs: number): Point[] {
  const dense = smooth(values);
  return makePoints(dense, spanSecs / (dense.length - 1));
}

function chartIndexFromPointer(event: React.PointerEvent<HTMLDivElement>, pointCount: number): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return Math.round(progress * (pointCount - 1));
}

/* measure the plot width so the SVG charts render in crisp pixel coordinates
 * (no aspect-ratio distortion of strokes or rounded bar ends). */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => { setWidth(node.clientWidth || 300); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);
  return [ref, width];
}

const CHART_H = 166;

interface Padding {
  top: number;
  bottom: number;
}

/* REAL inline-SVG multi-series line chart. Shared single y-axis across all
 * series; smoothed values already densified by the caller. */
function LineChart({
  series,
  width,
  padding,
  lineWidth = 2.25,
}: {
  series: { values: number[]; color: string }[];
  width: number;
  padding: Padding;
  lineWidth?: number;
}): JSX.Element {
  const all = series.flatMap((s) => s.values);
  const rawMin = all.length ? Math.min(...all) : 0;
  const rawMax = all.length ? Math.max(...all) : 1;
  const pad = (rawMax - rawMin) * 0.12 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const top = padding.top;
  const bottom = CHART_H - padding.bottom;

  const xFor = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const yFor = (v: number) => top + (1 - (v - min) / (max - min)) * (bottom - top);

  return (
    <svg className={styles.svg} width={width} height={CHART_H} aria-hidden>
      {series.map((s, si) => {
        const n = s.values.length;
        const points = s.values.map((v, i) => `${xFor(i, n).toFixed(2)},${yFor(v).toFixed(2)}`).join(" ");
        return (
          <polyline
            key={si}
            points={points}
            fill="none"
            stroke={s.color}
            strokeWidth={lineWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/* REAL inline-SVG bar chart, baseline-anchored with rounded data-ends and a
 * recessive horizontal grid. */
function BarChart({
  values,
  width,
  padding,
  color,
}: {
  values: number[];
  width: number;
  padding: Padding;
  color: string;
}): JSX.Element {
  const max = values.length ? Math.max(...values) * 1.1 : 1;
  const top = padding.top;
  const baseline = CHART_H - padding.bottom;
  const n = values.length;
  const slot = n > 0 ? width / n : width;
  const gap = 3;
  const barW = Math.max(2, slot - gap);
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <svg className={styles.svg} width={width} height={CHART_H} aria-hidden>
      {gridLines.map((f) => {
        const y = baseline - f * (baseline - top);
        return <line key={f} x1={0} x2={width} y1={y} y2={y} stroke="var(--grid-line)" strokeWidth={1} />;
      })}
      {values.map((v, i) => {
        const h = max > 0 ? (v / max) * (baseline - top) : 0;
        const x = i * slot + gap / 2;
        const y = baseline - h;
        return <rect key={i} x={x} y={y} width={barW} height={Math.max(0, h)} rx={3} fill={color} />;
      })}
    </svg>
  );
}

function ChartTooltip({ rows }: { rows: { label: string; value: string; color: string }[] }): JSX.Element {
  return (
    <div className={styles.tooltip}>
      {rows.map((row) => (
        <span key={row.label} className={styles.tooltipItem}>
          <span className={styles.tooltipDot} style={{ background: row.color }} />
          {row.value}
        </span>
      ))}
    </div>
  );
}

/* inline @entity mention */
const ENTITY_TONE = {
  "bg-orange": "var(--orange)",
  "bg-accent": "var(--accent)",
  "bg-green": "var(--green)",
} satisfies Record<string, string>;

function Entity({ name, tone }: { name: string; tone: string }): JSX.Element {
  const color = lookup(ENTITY_TONE, tone) ?? "var(--accent)";
  return (
    <span className={styles.entity}>
      <span className={styles.entityDot} style={{ background: color }} />@{name}
    </span>
  );
}

function Mono({ children, tone }: { children: React.ReactNode; tone: "red" | "green" }): JSX.Element {
  return <code className={tone === "red" ? styles.monoRed : styles.monoGreen}>{children}</code>;
}

/* 1 — return comparison: 2 series, legend + big deltas + line chart */
function CompareCard(): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [stageRef, width] = useWidth();
  const data = useMemo(
    () => ({
      mint: smoothPoints([-2.9, -3.4, -3.05, -3.86, -3.52, -4.1, -3.82, -4.41], 42),
      pistachio: smoothPoints([0.22, 0.58, 0.42, 0.91, 0.76, 1.08, 0.96, 1.15], 42),
    }),
    [],
  );

  const latestMint = data.mint.at(-1)?.value ?? -4.41;
  const latestPistachio = data.pistachio.at(-1)?.value ?? 1.15;
  const count = data.mint.length;

  const legend = [
    { name: "Mint Chip", delta: formatPercent(latestMint), sub: "-$2,377.66", tone: "red" as const, dot: "var(--orange)" },
    { name: "Pistachio", delta: formatPercent(latestPistachio), sub: "+$617.22", tone: "green" as const, dot: "var(--accent)" },
  ];

  const hoverMint = hoverIndex !== null ? data.mint[hoverIndex]?.value ?? 0 : 0;
  const hoverPistachio = hoverIndex !== null ? data.pistachio[hoverIndex]?.value ?? 0 : 0;

  return (
    <div className={styles.chartCard}>
      <div className={styles.legendRow}>
        {legend.map((s) => (
          <div key={s.name} className={styles.legendCol}>
            <span className={styles.legendName}>
              <span className={styles.legendDot} style={{ background: s.dot }} />
              {s.name}
            </span>
            <span className={s.tone === "red" ? styles.deltaRed : styles.deltaGreen}>{s.delta}</span>
            <Mono tone={s.tone}>{s.sub}</Mono>
          </div>
        ))}
      </div>
      <div className={styles.inset}>
        <div className={styles.insetHead}>
          <span className={styles.insetLabel}>Trend snapshot</span>
          <span className={styles.chip}>Snapshot</span>
        </div>
        <div
          ref={stageRef}
          className={styles.stage}
          onPointerDown={(event) => { setHoverIndex(chartIndexFromPointer(event, count)); }}
          onPointerMove={(event) => { setHoverIndex(chartIndexFromPointer(event, count)); }}
          onPointerLeave={() => { setHoverIndex(null); }}
          onPointerCancel={() => { setHoverIndex(null); }}
          onPointerUp={() => { setHoverIndex(null); }}
        >
          <LineChart
            width={width}
            padding={{ top: 40, bottom: 22 }}
            series={[
              { values: data.mint.map((p) => p.value), color: "var(--orange)" },
              { values: data.pistachio.map((p) => p.value), color: "var(--accent)" },
            ]}
          />
          {hoverIndex !== null && (
            <>
              <span className={styles.cursor} style={{ left: `${String((hoverIndex / (count - 1)) * 100)}%` }} />
              <span
                className={styles.tooltipAnchor}
                style={{ left: `${String(Math.min(Math.max((hoverIndex / (count - 1)) * 100, 28), 72))}%` }}
              >
                <ChartTooltip
                  rows={[
                    { label: "Mint Chip", value: formatPercent(hoverMint), color: "var(--orange)" },
                    { label: "Pistachio", value: formatPercent(hoverPistachio), color: "var(--accent)" },
                  ]}
                />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* 2 — anomaly: bars with threshold + big spent value */
function AnomalyCard(): JSX.Element {
  const [metric, setMetric] = useState<"spend" | "usage">("spend");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [stageRef, width] = useWidth();
  const spend = useMemo(() => makePoints([274, 289, 264, 307, 331, 1210, 1718, 2112], 7), []);
  const usage = useMemo(() => makePoints([18, 19, 17, 21, 22, 58, 81, 96], 7), []);

  const data = metric === "spend" ? spend : usage;
  const count = data.length;
  const threshold = metric === "spend" ? "$2,112" : "82 kWh";
  const moneyLabel = formatMoney(spend.at(-1)?.value ?? 2112);
  const hoverValue = hoverIndex !== null ? data[hoverIndex]?.value ?? 0 : 0;
  const fmt = (v: number) => (metric === "spend" ? formatMoney(v) : `${String(Math.round(v))} kWh`);

  return (
    <div className={styles.chartCard}>
      <div className={styles.anomalyHead}>
        <span className={styles.anomalyTitle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          High freezer spend
        </span>
        <span className={styles.chip}>Snapshot</span>
      </div>
      <div className={styles.inset}>
        <div className={styles.insetHead}>
          <span className={styles.insetLabel}>
            {hoverIndex !== null ? fmt(hoverValue) : `${threshold} threshold`}
          </span>
          <span className={styles.toggle}>
            {(["spend", "usage"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={metric === item}
                onClick={() => { setMetric(item); }}
                className={metric === item ? styles.toggleBtnActive : styles.toggleBtn}
              >
                {item === "spend" ? "Spend" : "Usage"}
              </button>
            ))}
          </span>
        </div>
        <div
          ref={stageRef}
          className={styles.stage}
          onPointerDown={(event) => { setHoverIndex(chartIndexFromPointer(event, count)); }}
          onPointerMove={(event) => { setHoverIndex(chartIndexFromPointer(event, count)); }}
          onPointerLeave={() => { setHoverIndex(null); }}
          onPointerCancel={() => { setHoverIndex(null); }}
          onPointerUp={() => { setHoverIndex(null); }}
          style={{ cursor: "crosshair" }}
        >
          <BarChart width={width} padding={{ top: 34, bottom: 22 }} color="var(--red)" values={data.map((p) => p.value)} />
          {hoverIndex !== null && (
            <>
              <span className={styles.cursor} style={{ left: `${String((hoverIndex / (count - 1)) * 100)}%` }} />
              <span
                className={styles.tooltipAnchor}
                style={{ left: `${String(Math.min(Math.max((hoverIndex / (count - 1)) * 100, 28), 72))}%` }}
              >
                <ChartTooltip rows={[{ label: metric === "spend" ? "Spend" : "Usage", value: fmt(hoverValue), color: "var(--red)" }]} />
              </span>
            </>
          )}
        </div>
      </div>
      <div className={styles.spentRow}>
        <span className={styles.spentValue}>{moneyLabel} spent</span>
        <Mono tone="red">+$1,834.66</Mono>
        <span className={styles.spentSub}>vs 3 months</span>
      </div>
    </div>
  );
}

/* 3 — allocation: hero number + segmented bar + legend */
interface Segment {
  name: string;
  label: string;
  pct: number;
  amount: string;
  bar: string;
  ink: string;
}

const ALLOC_SEGMENTS: [Segment, ...Segment[]] = [
  { name: "VAN", label: "Vanilla", pct: 72.5, amount: "$51,785", bar: "var(--orange)", ink: "var(--orange)" },
  { name: "CHOC", label: "Chocolate", pct: 22.8, amount: "$16,278", bar: "var(--line-strong)", ink: "var(--ink-2)" },
  { name: "MINT", label: "Mint", pct: 4.7, amount: "$3,357", bar: "var(--line)", ink: "var(--ink-3)" },
];

function AllocationCard(): JSX.Element {
  const first = ALLOC_SEGMENTS[0];
  const [selected, setSelected] = useState(first.name);
  const active = ALLOC_SEGMENTS.find((segment) => segment.name === selected) ?? first;

  return (
    <div className={styles.chartCard}>
      <span className={styles.allocTitle}>
        <span className={styles.allocBadge}>V</span>
        Vanilla allocation
      </span>
      <span className={styles.allocHero}>{active.amount}</span>
      <div className={styles.allocBar} role="group" aria-label="Allocation segments">
        {ALLOC_SEGMENTS.map((s) => {
          const on = selected === s.name;
          return (
            <button
              key={s.name}
              type="button"
              aria-pressed={on}
              aria-label={`${s.label}: ${String(s.pct)}%`}
              onClick={() => { setSelected(s.name); }}
              className={styles.allocSeg}
              style={{
                width: `${String(s.pct)}%`,
                background: s.bar,
                opacity: on ? 1 : 0.58,
                boxShadow: on ? "inset 0 0 0 1px rgba(255,255,255,0.22)" : undefined,
                transitionTimingFunction: EASE,
              }}
            >
              <span
                className={styles.allocSegGlow}
                style={{
                  width: on ? "calc(100% - 8px)" : "0%",
                  opacity: on ? 1 : 0,
                  transitionTimingFunction: EASE,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className={styles.allocLegend}>
        {ALLOC_SEGMENTS.map((s) => {
          const on = selected === s.name;
          return (
            <button
              key={s.name}
              type="button"
              aria-pressed={on}
              onClick={() => { setSelected(s.name); }}
              className={on ? styles.allocChipActive : styles.allocChip}
            >
              <span className={styles.allocChipDot} style={{ background: s.bar }} />
              {s.name} <span className={styles.tnum}>{s.pct}%</span>
            </button>
          );
        })}
      </div>
      <div className={styles.allocNote}>
        <span className={styles.allocNoteLabel} style={{ color: active.ink }}>{active.label}</span>
        <span className={styles.allocNoteBody}>
          Contribution snapshot across current inventory value. Segment selection changes the inspected group without
          moving the card.
        </span>
      </div>
    </div>
  );
}

interface PageDef {
  key: string;
  prose: React.ReactNode;
  Card: () => JSX.Element;
  pill: string;
}

const PAGES: [PageDef, ...PageDef[]] = [
  {
    key: "compare",
    prose: (
      <>
        The worst performer in your <Entity name="Creamery" tone="bg-orange" /> is Rocky Road — down{" "}
        <Mono tone="red">-6%</Mono> or <Mono tone="red">-$2,453.44</Mono>.
      </>
    ),
    Card: CompareCard,
    pill: "Should I rebalance flavors?",
  },
  {
    key: "anomaly",
    prose: (
      <>
        Unusually high freezer bill on <span className={styles.proseStrong}>Dec 13</span> —{" "}
        <Mono tone="red">+$1,834.66</Mono> above your average.
      </>
    ),
    Card: AnomalyCard,
    pill: "Get tips on cutting freezer costs",
  },
  {
    key: "allocation",
    prose: (
      <>
        You’re heavily invested in <Entity name="Vanilla" tone="bg-orange" /> — it’s{" "}
        <span className={styles.proseStrong}>72.5%</span> of your case.
      </>
    ),
    Card: AllocationCard,
    pill: "If we look at seasonals, what changes?",
  },
];

export interface InsightCardsProps {
  /** starting page index (0=compare, 1=anomaly, 2=allocation) */
  initialPage?: number;
}

export function InsightCards({ initialPage = 0 }: InsightCardsProps): JSX.Element {
  const [page, setPage] = useState(initialPage);

  const move = (direction: -1 | 1) => {
    setPage((current) => (current + direction + PAGES.length) % PAGES.length);
  };

  const { prose, Card, pill } = PAGES[page] ?? PAGES[0];

  return (
    <div className={styles.root}>
      {/* pager header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <span className={styles.headerName}>Insights</span>
          <span className={styles.headerCount}>{PAGES.length}</span>
        </span>
        <span className={styles.pager}>
          {(["M15 18l-6-6 6-6", "M9 6l6 6-6 6"] as const).map((d, i) => (
            <button
              key={i}
              aria-label={i === 0 ? "Previous insight" : "Next insight"}
              onClick={() => { move(i === 0 ? -1 : 1); }}
              className={styles.pagerBtn}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
        </span>
      </div>

      {/* page content — blurred crossfade */}
      <div className={styles.content} style={{ opacity: 1, filter: "blur(0)" }}>
        <p className={styles.prose}>{prose}</p>
        <div className={styles.cardSlot}>
          <Card />
        </div>
        <button className={styles.pill}>{pill}</button>
      </div>
    </div>
  );
}
