import clsx from "clsx";
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./Flowchart.module.css";

// Flowchart — beautifului session-tree viz. Two step cards (a Trigger and an
// If/Else condition) joined by a measured bezier connector. Cards drag anywhere
// on the canvas; the connector follows. Condition chips open real dropdowns
// (the same menu pattern as the PromptBar model picker). Ported verbatim from
// the real source; Tailwind → CSS Modules over DSH bridge vars. StepNode type
// and edge-drawing geometry preserved exactly.

const PURPLE = "#9a5cff";
const AMBER = "#f09a2f";

const mix = (hue: string, pct: number, base = "var(--surface)"): string =>
  `color-mix(in srgb, ${hue} ${String(pct)}%, ${base})`;

/* ── layout constants ── */
const PAD_Y = 24;
const ROW_GAP = 64;
const PILL_OFFSET = 30; // kind pill + gap above a card

interface StepNode {
  id: string;
  row: number;
  x: number; // 0–1 center of the node
  w: number;
  kind?: { label: string; hue: string };
  hue?: string;
  title?: string;
  caption?: string;
  condition?: boolean; // renders the if/else chip rows instead
}

const NODES: StepNode[] = [
  {
    id: "trigger",
    row: 0,
    x: 0.5,
    w: 300,
    kind: { label: "Trigger", hue: PURPLE },
    hue: PURPLE,
    title: "New order created",
    caption: "Trigger when a new order is created",
  },
  {
    id: "cond",
    row: 1,
    x: 0.5,
    w: 356,
    kind: { label: "If / Else", hue: AMBER },
    condition: true,
  },
];

const EDGES = [{ from: "trigger", to: "cond" }];

/* estimated heights for the first paint; measured immediately after */
const EST_H: Record<string, number> = { trigger: 92, cond: 134 };

const PROPERTIES = ["flavor", "topping", "size", "scoops"];
const FLAVORS = [
  { name: "Rocky Road", tag: "Classic" },
  { name: "Mint Chip", tag: "Classic" },
  { name: "Pistachio", tag: "Seasonal" },
  { name: "Bubblegum", tag: "Retro" },
];
const TOPPINGS = [
  { name: "Brown butter bourbon brittle crunch" },
  { name: "Rainbow sprinkles" },
  { name: "Hot fudge" },
  { name: "Candied pecans" },
];

/* ── icons ── */
function ConeIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
      <path d="M17 7A5 5 0 0 0 7 7" />
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
    </svg>
  );
}

function Chevron(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.chevron}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Handle(): JSX.Element {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" className={styles.handle}>
      {[3, 8, 13].flatMap((y) => [
        <circle key={`l${String(y)}`} cx="3" cy={y} r="1.1" fill="currentColor" />,
        <circle key={`r${String(y)}`} cx="7.5" cy={y} r="1.1" fill="currentColor" />,
      ])}
    </svg>
  );
}

function FlowCheckIcon(): JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ── dropdown menu — same pattern as the PromptBar model picker ── */
function FlowMenu({
  items,
  value,
  width,
  align,
  onPick,
}: {
  items: { name: string; tag?: string }[];
  value: string;
  width: number;
  align: "left" | "right";
  onPick: (name: string) => void;
}): JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  const valueIndex = items.findIndex((item) => item.name === value);
  useLayoutEffect(() => {
    const row = rowRefs.current[hovered ?? valueIndex];
    if (row) setBox({ top: row.offsetTop, height: row.offsetHeight });
  }, [hovered, valueIndex]);

  return (
    <div
      onMouseLeave={() => { setHovered(null); }}
      className={clsx(styles.menu, align === "right" ? styles.menuRight : styles.menuLeft)}
      style={{
        width,
        transformOrigin: align === "right" ? "bottom right" : "bottom left",
      }}
    >
      <span
        aria-hidden
        className={styles.menuHighlight}
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && hovered !== null ? 1 : 0,
        }}
      />
      {items.map((item, i) => (
        <button
          key={item.name}
          type="button"
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          onMouseEnter={() => { setHovered(i); }}
          onClick={() => { onPick(item.name); }}
          className={styles.menuRow}
        >
          <span className={styles.menuName}>{item.name}</span>
          {item.tag !== undefined && <span className={styles.menuTag}>{item.tag}</span>}
          <span className={clsx(styles.menuCheck, !(item.name === value) && styles.invisible)}>
            <FlowCheckIcon />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── chips used inside the condition card ── */
function FlowSourceChip(): JSX.Element {
  return (
    <span data-ui className={styles.sourceChip}>
      <span className={styles.sourceChipIcon}>
        <ConeIcon size={12} />
      </span>
      order
    </span>
  );
}

function SelectChip({
  id,
  value,
  dot,
  items,
  width,
  align = "left",
  open,
  onToggle,
  onPick,
}: {
  id: string;
  value: string;
  dot?: boolean;
  items: { name: string; tag?: string }[];
  width: number;
  align?: "left" | "right";
  open: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, name: string) => void;
}): JSX.Element {
  return (
    <span data-ui className={styles.selectChip}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { onToggle(id); }}
        className={clsx(styles.selectBtn, open ? styles.selectBtnOpen : styles.selectBtnIdle)}
      >
        {dot === true && <span className={styles.dot} style={{ background: AMBER }} />}
        <span className={styles.selectValue}>{value}</span>
        <Chevron />
      </button>
      {open && (
        <FlowMenu items={items} value={value} width={width} align={align} onPick={(name) => { onPick(id, name); }} />
      )}
    </span>
  );
}

function ConditionBody(): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({
    prop1: "flavor",
    val1: "Rocky Road",
    prop2: "topping",
    val2: "Brown butter bourbon brittle crunch",
  });
  const [open, setOpen] = useState<string | null>(null);

  /* click anywhere else closes the menu */
  useEffect(() => {
    if (open === null) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-ui]")) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); };
  }, [open]);

  const toggle = (id: string) => { setOpen((current) => (current === id ? null : id)); };
  const pick = (id: string, name: string) => {
    setValues((current) => ({ ...current, [id]: name }));
    setOpen(null);
  };

  const chip = (
    id: string,
    items: { name: string; tag?: string }[],
    width: number,
    extra?: { dot?: boolean; align?: "left" | "right" },
  ) => (
    <SelectChip
      id={id}
      value={values[id] ?? ""}
      items={items}
      width={width}
      open={open === id}
      onToggle={toggle}
      onPick={pick}
      {...extra}
    />
  );

  return (
    <div className={styles.condBody}>
      <div className={styles.condRow}>
        <Handle />
        <span className={styles.condKw}>If</span>
        <FlowSourceChip />
        {chip("prop1", PROPERTIES.map((name) => ({ name })), 144)}
        <span className={styles.condIs}>is</span>
        {chip("val1", FLAVORS, 176, { dot: true, align: "right" })}
      </div>
      <div className={styles.condRowWrap}>
        <Handle />
        <span className={styles.condKw}>and</span>
        <FlowSourceChip />
        {chip("prop2", PROPERTIES.map((name) => ({ name })), 144)}
        <span className={styles.condIs}>is</span>
        <span className={styles.condVal2Wrap}>{chip("val2", TOPPINGS, 256, { dot: true })}</span>
      </div>
    </div>
  );
}

function StepBody({ node }: { node: StepNode }): JSX.Element {
  const hue = node.hue ?? "var(--ink-3)";
  return (
    <div className={styles.stepBody}>
      <span
        className={styles.stepIcon}
        style={{
          background: mix(hue, 12),
          color: hue,
          boxShadow: `0 0 0 1px ${mix(hue, 20)}`,
        }}
      >
        <ConeIcon />
      </span>
      <span className={styles.stepText}>
        <span className={styles.stepTitle}>{node.title}</span>
        <span className={styles.stepCaption}>{node.caption}</span>
      </span>
    </div>
  );
}

/* ── the canvas ── */
export function Flowchart(): JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>(EST_H);
  const [selected, setSelected] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measure = () => {
      setWidth(canvas.clientWidth);
      setHeights((prev) => {
        const next = { ...prev };
        const state = { changed: false };
        nodeRefs.current.forEach((el, id) => {
          const h = el.offsetHeight;
          if (h && Math.abs(h - (next[id] ?? 0)) > 0.5) {
            next[id] = h;
            state.changed = true;
          }
        });
        return state.changed ? next : prev;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    nodeRefs.current.forEach((el) => { observer.observe(el); });
    return () => { observer.disconnect(); };
  }, []);

  /* rows → y offsets from measured node heights */
  const rows = [...new Set(NODES.map((n) => n.row))].sort((a, b) => a - b);
  const rowH = rows.map((r) =>
    Math.max(...NODES.filter((n) => n.row === r).map((n) => heights[n.id] ?? 90)),
  );
  const rowY: number[] = [];
  rows.forEach((_, i) => {
    rowY[i] = i === 0 ? PAD_Y : (rowY[i - 1] ?? 0) + (rowH[i - 1] ?? 0) + ROW_GAP;
  });
  const canvasH = (rowY[rows.length - 1] ?? 0) + (rowH[rows.length - 1] ?? 0) + PAD_Y;

  const cw = width || 480;
  const place = (n: StepNode) => {
    const w = Math.min(n.w, cw * 0.92);
    const off = offsets[n.id];
    return {
      w,
      cx: n.x * cw + (off?.dx ?? 0),
      top: (rowY[rows.indexOf(n.row)] ?? 0) + (off?.dy ?? 0),
    };
  };

  /* card anchor points (pills sit above the card, so offset the top) */
  const anchors = (n: StepNode) => {
    const { cx, top } = place(n);
    return {
      top: { x: cx, y: top + (n.kind ? PILL_OFFSET : 0) },
      bottom: { x: cx, y: top + (heights[n.id] ?? 90) },
    };
  };

  const bezier = (edge: { from: string; to: string }) => {
    const fromNode = NODES.find((n) => n.id === edge.from);
    const toNode = NODES.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return "";
    const from = anchors(fromNode).bottom;
    const to = anchors(toNode).top;
    const k = Math.min(Math.max(Math.abs(to.y - from.y) * 0.55, 24), 84);
    return `M ${String(from.x)} ${String(from.y)} C ${String(from.x)} ${String(from.y + k)}, ${String(to.x)} ${String(to.y - k)}, ${String(to.x)} ${String(to.y)}`;
  };

  /* ── dragging ── */
  const onPointerDown = (node: StepNode) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("[data-ui]")) return;
    const off = offsets[node.id];
    drag.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      baseDx: off?.dx ?? 0,
      baseDy: off?.dy ?? 0,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (node: StepNode) => (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== node.id) return;
    const dx = d.baseDx + event.clientX - d.startX;
    const dy = d.baseDy + event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx - d.baseDx, dy - d.baseDy) < 3) return;
    d.moved = true;

    /* keep the card inside the canvas */
    const { w } = place(node);
    const h = heights[node.id] ?? 90;
    const baseCx = node.x * cw;
    const baseTop = rowY[rows.indexOf(node.row)] ?? 0;
    const cx = Math.min(Math.max(baseCx + dx, w / 2 + 8), cw - w / 2 - 8);
    const top = Math.min(Math.max(baseTop + dy, 8), canvasH - h - 8);
    setOffsets((current) => ({ ...current, [node.id]: { dx: cx - baseCx, dy: top - baseTop } }));
  };

  const onPointerUp = (node: StepNode) => () => {
    const d = drag.current;
    if (d?.id === node.id) {
      /* a real drag shouldn't also toggle selection */
      if (d.moved) setTimeout(() => (drag.current = null), 0);
      else drag.current = null;
    }
  };

  const wasDragged = () => drag.current?.moved === true;

  const isLit = (edge: { from: string; to: string }) => selected === edge.from || selected === edge.to;

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      style={{
        height: canvasH,
        backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1.25px)",
        backgroundSize: "22px 22px",
        backgroundPosition: "center",
      }}
    >
      {/* connectors */}
      <svg width={cw} height={canvasH} className={styles.connectors}>
        {EDGES.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}`}
            d={bezier(edge)}
            fill="none"
            stroke={isLit(edge) ? "var(--accent)" : "var(--line-strong)"}
            strokeWidth="1.25"
            className={styles.edge}
          />
        ))}
      </svg>

      {/* nodes */}
      {NODES.map((node) => {
        const { w, cx, top } = place(node);
        const active = selected === node.id;
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(node.id, el);
              else nodeRefs.current.delete(node.id);
            }}
            onPointerDown={onPointerDown(node)}
            onPointerMove={onPointerMove(node)}
            onPointerUp={onPointerUp(node)}
            className={styles.node}
            style={{ left: cx, top, width: w, zIndex: drag.current?.id === node.id ? 2 : 1 }}
          >
            {node.kind && (
              <span
                className={styles.kindPill}
                style={{
                  background: mix(node.kind.hue, 14, "var(--page)"),
                  color: mix(node.kind.hue, 80, "var(--ink)"),
                }}
              >
                {node.kind.label}
              </span>
            )}
            {node.condition === true ? (
              <div className={styles.condCard}>
                <ConditionBody />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (wasDragged()) return;
                  setSelected(active ? null : node.id);
                }}
                aria-pressed={active}
                className={clsx(styles.stepBtn, active ? styles.stepBtnActive : styles.stepBtnIdle)}
              >
                <StepBody node={node} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
