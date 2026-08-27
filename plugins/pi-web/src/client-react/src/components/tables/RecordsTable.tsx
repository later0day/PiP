import clsx from "clsx";
import { type JSX, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { GlideMenu } from "../../primitives";
import { lookup } from "../../lib/lookup";
import { cssVars } from "../../lib/cssVars";
import styles from "./RecordsTable.module.css";

// RecordsTable — beautifului tables #1. A sortable, selectable, column-resizable
// records grid with a per-property configuration popover (type / tool / grounding
// / inputs / prompt), a "+ new property" menu that adds an AI column, and a
// staggered calculation that resolves rows one beat at a time. Ported verbatim
// from the real source; Tailwind + the original global `records-*` classes are
// translated into CSS Modules over DSH bridge vars. The SortKey type and the
// sort / pointer-resize logic are preserved exactly.

type SortKey = "name" | "last" | "strength";
type ColumnKey = "company" | "categories" | "last" | "strength" | "links" | "ai";
type Strength = "strong" | "weak" | "veryweak" | "none";

const DEFAULT_COLUMN_WIDTHS = {
  company: 270,
  categories: 275,
  last: 190,
  strength: 210,
  links: 175,
  ai: 240,
} satisfies Record<ColumnKey, number>;

const STRENGTH = {
  strong: { label: "Very strong", color: "var(--green)", rank: 3 },
  weak: { label: "Weak", color: "var(--orange)", rank: 2 },
  veryweak: { label: "Very weak", color: "var(--red)", rank: 1 },
  none: { label: "No communication", color: "var(--ink-3)", rank: 0 },
} satisfies Record<Strength, { label: string; color: string; rank: number }>;

// A single mid-lightness base hue per tag. Background, text, and border are
// derived from this via color-mix() against the theme tokens in .tag, so the
// chips adapt to light and dark automatically.
interface TagColor { base: string }

const TAG_PALETTE = {
  amber: { base: "oklch(0.76 0.13 70)" },
  lime: { base: "oklch(0.77 0.16 122)" },
  yellow: { base: "oklch(0.80 0.15 101)" },
  purple: { base: "oklch(0.62 0.18 293)" },
  orange: { base: "oklch(0.71 0.16 48)" },
  cyan: { base: "oklch(0.72 0.10 221)" },
  red: { base: "oklch(0.64 0.19 27)" },
  magenta: { base: "oklch(0.66 0.21 323)" },
  green: { base: "oklch(0.70 0.13 162)" },
  pink: { base: "oklch(0.67 0.19 3)" },
} satisfies Record<string, TagColor>;

const TAG_COLORS = {
  B2B: TAG_PALETTE.amber,
  B2C: TAG_PALETTE.lime,
  Cafe: TAG_PALETTE.red,
  Catering: TAG_PALETTE.magenta,
  "Dairy-free": TAG_PALETTE.cyan,
  Gelato: TAG_PALETTE.purple,
  Imports: TAG_PALETTE.orange,
  Local: TAG_PALETTE.green,
  Seasonal: TAG_PALETTE.yellow,
  Sorbet: TAG_PALETTE.pink,
  Vegan: TAG_PALETTE.lime,
  Wholesale: TAG_PALETTE.amber,
} satisfies Record<string, TagColor>;

interface Row {
  id: string;
  name: string;
  tags: string[];
  last: string;
  strength: Strength;
  website?: string;
}

const INITIAL_ROWS: Row[] = [
  { id: "aurora", name: "Aurora Scoops — Reykjavík", tags: ["Gelato", "Seasonal"], last: "9 days ago", strength: "strong", website: "aurora-scoops.example.com" },
  { id: "kumo", name: "Kumo Creamery — Tokyo", tags: ["B2C", "Cafe", "Vegan"], last: "3 weeks ago", strength: "strong", website: "kumo-creamery.example.com" },
  { id: "sol-nieve", name: "Sol y Nieve — Buenos Aires", tags: ["Gelato", "Local"], last: "2 months ago", strength: "weak", website: "sol-y-nieve.example.com" },
  { id: "maple-orbit", name: "Maple Orbit — Montréal", tags: ["B2B", "Wholesale", "Seasonal"], last: "15 days ago", strength: "weak", website: "maple-orbit.example.com" },
  { id: "blue-fig", name: "Blue Fig Gelato — Florence", tags: ["Gelato", "Cafe"], last: "over 1 year ago", strength: "veryweak", website: "blue-fig.example.com" },
  { id: "sahara-swirl", name: "Sahara Swirl — Marrakech", tags: ["Sorbet", "Local"], last: "5 months ago", strength: "veryweak" },
  { id: "cloudberry", name: "Cloudberry Cone — Helsinki", tags: ["Dairy-free", "Seasonal"], last: "No contact", strength: "none", website: "cloudberry-cone.example.com" },
  { id: "palm-sugar", name: "Palm Sugar Creamery — Bangkok", tags: ["B2C", "Vegan"], last: "3 months ago", strength: "veryweak", website: "palm-sugar.example.com" },
  { id: "cape-vanilla", name: "Cape Vanilla Co. — Cape Town", tags: ["Wholesale", "Imports"], last: "over 1 year ago", strength: "veryweak", website: "cape-vanilla.example.com" },
  { id: "andes-snow", name: "Andes Snow Creamery — Quito", tags: ["Gelato", "Catering"], last: "almost 2 years ago", strength: "veryweak" },
  { id: "tasman-sea", name: "Tasman Sea Gelato — Hobart", tags: ["Gelato", "Local"], last: "2 months ago", strength: "weak", website: "tasman-sea.example.com" },
  { id: "silk-road", name: "Silk Road Sorbet — Tbilisi", tags: ["Sorbet", "Imports"], last: "about 1 month ago", strength: "weak", website: "silk-road.example.com" },
  { id: "rosewater", name: "Rosewater Kulfi — Jaipur", tags: ["B2C", "Seasonal"], last: "2 months ago", strength: "veryweak" },
  { id: "lumen", name: "Lumen Soft Serve — Copenhagen", tags: ["Dairy-free", "Cafe"], last: "8 months ago", strength: "weak", website: "lumen-soft-serve.example.com" },
  { id: "cacao-norte", name: "Cacao Norte — Oaxaca", tags: ["B2B", "Local", "Wholesale"], last: "about 2 years ago", strength: "none", website: "cacao-norte.example.com" },
  { id: "pine-pistachio", name: "Pine & Pistachio — Istanbul", tags: ["Gelato", "Catering"], last: "about 1 month ago", strength: "veryweak" },
  { id: "ember-cone", name: "Ember Cone Company — Seoul", tags: ["B2C", "Vegan"], last: "15 days ago", strength: "weak", website: "ember-cone.example.com" },
  { id: "coral-coast", name: "Coral Coast Sorbet — Honolulu", tags: ["Sorbet", "Local"], last: "9 days ago", strength: "strong", website: "coral-coast.example.com" },
  { id: "sunbird", name: "Sunbird Gelateria — Lisbon", tags: ["Gelato", "Cafe"], last: "over 2 years ago", strength: "none", website: "sunbird.example.com" },
  { id: "mooncake", name: "Mooncake Ice Cream — Singapore", tags: ["B2B", "Wholesale"], last: "about 1 month ago", strength: "veryweak", website: "mooncake-ice-cream.example.com" },
  { id: "juniper", name: "Juniper & Cream — Vancouver", tags: ["Dairy-free", "Catering"], last: "No contact", strength: "none" },
  { id: "mango-moon", name: "Mango Moon Gelato — Nairobi", tags: ["Sorbet", "Vegan"], last: "almost 2 years ago", strength: "veryweak", website: "mango-moon.example.com" },
  { id: "fjord-fizz", name: "Fjord Fizz Ice — Oslo", tags: ["Dairy-free", "Seasonal"], last: "No contact", strength: "none" },
  { id: "pampa", name: "Pampa Creamery — Córdoba", tags: ["B2C", "Local"], last: "12 months ago", strength: "veryweak", website: "pampa-creamery.example.com" },
  { id: "lotus-leaf", name: "Lotus Leaf Scoops — Hanoi", tags: ["Vegan", "Cafe"], last: "15 days ago", strength: "weak" },
  { id: "saffron-sky", name: "Saffron Sky Kulfi — Dubai", tags: ["Imports", "Catering"], last: "almost 2 years ago", strength: "veryweak", website: "saffron-sky.example.com" },
  { id: "alpine-churn", name: "Alpine Churn — Zürich", tags: ["B2B", "Gelato", "Wholesale"], last: "4 days ago", strength: "strong", website: "alpine-churn.example.com" },
  { id: "monsoon-mango", name: "Monsoon Mango — Mumbai", tags: ["Sorbet", "Vegan", "Catering"], last: "18 days ago", strength: "weak", website: "monsoon-mango.example.com" },
  { id: "cedar-spoon", name: "Cedar Spoon — Beirut", tags: ["Cafe", "Local", "Seasonal"], last: "6 days ago", strength: "strong", website: "cedar-spoon.example.com" },
  { id: "baltic-berry", name: "Baltic Berry — Tallinn", tags: ["Dairy-free", "Seasonal", "B2C"], last: "5 weeks ago", strength: "weak", website: "baltic-berry.example.com" },
  { id: "delta-dairy", name: "Delta Dairy Works — New Orleans", tags: ["B2B", "Wholesale", "Local"], last: "2 days ago", strength: "strong", website: "delta-dairy.example.com" },
  { id: "yuzu-yard", name: "Yuzu Yard — Kyoto", tags: ["Sorbet", "Cafe", "Seasonal"], last: "11 days ago", strength: "strong", website: "yuzu-yard.example.com" },
  { id: "copper-cone", name: "Copper Cone — Melbourne", tags: ["Gelato", "Cafe", "B2C"], last: "about 1 month ago", strength: "weak", website: "copper-cone.example.com" },
  { id: "mint-medina", name: "Mint Medina — Tunis", tags: ["Dairy-free", "Vegan", "Local"], last: "No contact", strength: "none" },
  { id: "glacier-grove", name: "Glacier Grove — Anchorage", tags: ["Seasonal", "Local", "Catering"], last: "7 weeks ago", strength: "weak", website: "glacier-grove.example.com" },
  { id: "orchard-cloud", name: "Orchard Cloud — Lyon", tags: ["Gelato", "Seasonal", "Cafe"], last: "5 days ago", strength: "strong", website: "orchard-cloud.example.com" },
  { id: "tamarind-tide", name: "Tamarind Tide — Chennai", tags: ["Vegan", "Sorbet", "B2C"], last: "9 months ago", strength: "veryweak", website: "tamarind-tide.example.com" },
  { id: "amber-scoop", name: "Amber Scoop — Prague", tags: ["Gelato", "B2B"], last: "over 1 year ago", strength: "none" },
  { id: "boreal-batch", name: "Boreal Batch — Yellowknife", tags: ["Dairy-free", "Local", "Seasonal"], last: "8 days ago", strength: "strong", website: "boreal-batch.example.com" },
  { id: "coconut-commons", name: "Coconut Commons — Manila", tags: ["Vegan", "B2C", "Cafe"], last: "24 days ago", strength: "weak", website: "coconut-commons.example.com" },
  { id: "dolomite-dairy", name: "Dolomite Dairy — Bolzano", tags: ["Gelato", "Wholesale"], last: "3 days ago", strength: "strong", website: "dolomite-dairy.example.com" },
  { id: "equator-cream", name: "Equator Cream — Kampala", tags: ["B2B", "Catering", "Local"], last: "10 months ago", strength: "veryweak", website: "equator-cream.example.com" },
  { id: "hibiscus-house", name: "Hibiscus House — Accra", tags: ["Sorbet", "Cafe"], last: "6 weeks ago", strength: "weak", website: "hibiscus-house.example.com" },
  { id: "lagoon-ladle", name: "Lagoon Ladle — Venice", tags: ["Gelato", "Seasonal", "Catering"], last: "7 days ago", strength: "strong", website: "lagoon-ladle.example.com" },
  { id: "midnight-milk", name: "Midnight Milk — Tromsø", tags: ["Dairy-free", "Vegan", "Wholesale"], last: "No contact", strength: "none" },
  { id: "nomad-nougat", name: "Nomad Nougat — Ulaanbaatar", tags: ["Imports", "B2B"], last: "almost 2 years ago", strength: "none", website: "nomad-nougat.example.com" },
  { id: "olive-snow", name: "Olive Snow — Athens", tags: ["Gelato", "Cafe", "Local"], last: "4 days ago", strength: "strong", website: "olive-snow.example.com" },
  { id: "pacific-pear", name: "Pacific Pear — Valparaíso", tags: ["Sorbet", "Seasonal"], last: "2 months ago", strength: "weak", website: "pacific-pear.example.com" },
  { id: "quartz-cone", name: "Quartz Cone — Denver", tags: ["B2C", "Wholesale"], last: "10 days ago", strength: "strong", website: "quartz-cone.example.com" },
  { id: "red-lantern", name: "Red Lantern Creamery — Taipei", tags: ["Cafe", "Vegan"], last: "about 1 month ago", strength: "weak", website: "red-lantern.example.com" },
  { id: "salt-silk", name: "Salt & Silk — Muscat", tags: ["Imports", "Catering", "Gelato"], last: "8 months ago", strength: "veryweak", website: "salt-and-silk.example.com" },
  { id: "tropic-churn", name: "Tropic Churn — San Juan", tags: ["Sorbet", "Local", "B2C"], last: "6 days ago", strength: "strong", website: "tropic-churn.example.com" },
  { id: "umber-cream", name: "Umber Cream — Warsaw", tags: ["B2B", "Wholesale", "Cafe"], last: "5 weeks ago", strength: "weak", website: "umber-cream.example.com" },
  { id: "vanilla-vale", name: "Vanilla Vale — Antananarivo", tags: ["Imports", "Local"], last: "No contact", strength: "none" },
  { id: "willow-whip", name: "Willow Whip — Portland", tags: ["Dairy-free", "Vegan", "Cafe"], last: "3 days ago", strength: "strong", website: "willow-whip.example.com" },
  { id: "zenith-gelato", name: "Zenith Gelato — Auckland", tags: ["Gelato", "Seasonal"], last: "3 weeks ago", strength: "weak", website: "zenith-gelato.example.com" },
  { id: "apricot-atlas", name: "Apricot Atlas — Algiers", tags: ["Sorbet", "Imports"], last: "11 months ago", strength: "veryweak", website: "apricot-atlas.example.com" },
  { id: "black-sesame", name: "Black Sesame Social — Bandung", tags: ["Vegan", "Cafe", "B2C"], last: "9 days ago", strength: "strong", website: "black-sesame.example.com" },
  { id: "crimson-clover", name: "Crimson Clover — Brussels", tags: ["Gelato", "Wholesale", "Catering"], last: "2 months ago", strength: "weak", website: "crimson-clover.example.com" },
  { id: "dragonfruit-dock", name: "Dragonfruit Dock — Shenzhen", tags: ["Sorbet", "B2B", "Wholesale"], last: "No contact", strength: "none" },
];

/* the AI column resolves to fictional competitor pairs */
const AI_LABEL = "Competitors";
const COMPETITOR_POOL = [
  "Frost & Ladle",
  "Polar Pint Co.",
  "Meltwater Creamery",
  "Cirrus Scoops",
  "Golden Churn",
  "Velvet Freeze",
  "North Cone Collective",
  "Sundae Syndicate",
];
const competitorsFor = (index: number) =>
  `${COMPETITOR_POOL[index % 8] ?? ""}, ${COMPETITOR_POOL[(index + 3) % 8] ?? ""}`;

function TableIcon({ children, size = 14, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/* glyph library for property types & tools */
const TYPE_GLYPHS: Record<string, React.ReactNode> = {
  Text: <path d="M4 6h16M4 12h10M4 18h7" />,
  File: <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g>,
  Collection: <g><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></g>,
  "Single select": <g><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4 4.6-4.9" /></g>,
  "Multi select": <g><path d="M11 6h9M11 12h9M11 18h9" /><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" /></g>,
  URL: <g><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></g>,
  Reference: <path d="M7 17 17 7M9 7h8v8" />,
  JSON: <g><path d="M8 4c-2 0-2 2-2 3s.5 3-2 3c2.5 0 2 2 2 3s0 3 2 3" /><path d="M16 4c2 0 2 2 2 3s-.5 3 2 3c-2.5 0-2 2-2 3s0 3-2 3" /></g>,
  "File splitter": <g><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></g>,
  Date: <g><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></g>,
};

const TOOL_GLYPHS: Record<string, React.ReactNode> = {
  model: <path d="M12 3l1.7 5.1a2 2 0 0 0 1.2 1.2L20 11l-5.1 1.7a2 2 0 0 0-1.2 1.2L12 19l-1.7-5.1a2 2 0 0 0-1.2-1.2L4 11l5.1-1.7a2 2 0 0 0 1.2-1.2z" />,
  web: <g><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13.5 13.5 0 0 1 3.5 9 13.5 13.5 0 0 1-3.5 9 13.5 13.5 0 0 1-3.5-9A13.5 13.5 0 0 1 12 3z" /></g>,
  user: <g><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></g>,
};

/* per-property configuration shown in the popover */
interface Prompt { before: string; chip?: string; after?: string }
type ToolKind = "model" | "web" | "user";
interface ColumnMeta { type: string; tool: string; toolKind: ToolKind; inputs?: string; prompt?: Prompt }

const COLUMN_META: Record<string, ColumnMeta> = {
  Company: { type: "Text", tool: "User input", toolKind: "user" },
  Categories: { type: "Multi select", tool: "Sprinkles 5", toolKind: "model", inputs: "Company", prompt: { before: "Tag each ", chip: "Company", after: " with its market categories." } },
  "Last interaction": { type: "Date", tool: "User input", toolKind: "user" },
  "Connection strength": { type: "Single select", tool: "Sprinkles 5", toolKind: "model", inputs: "Last interaction", prompt: { before: "Score the relationship from ", chip: "Last interaction", after: "." } },
  Links: { type: "URL", tool: "Web search", toolKind: "web", inputs: "Company", prompt: { before: "Find the website for ", chip: "Company", after: "." } },
  [AI_LABEL]: { type: "Text", tool: "Web search", toolKind: "web", inputs: "Company", prompt: { before: "Find competitors for ", chip: "Company" } },
};

const NEW_PROPERTY_TYPES = ["Text", "File", "Collection", "Single select", "Multi select", "URL", "Reference", "JSON", "File splitter"];
const MODEL_OPTIONS = ["Sprinkles 5", "Sprinkles 4.2", "Sprinkles Mini"];
const INPUT_OPTIONS = ["Company", "Categories", "Last interaction", "Connection strength", "Links"];

function Checkbox({ checked, mixed = false, onChange, label }: { checked: boolean; mixed?: boolean; onChange: () => void; label: string }): JSX.Element {
  return (
    <label className={styles.checkbox} title={label} onClick={(event) => { event.stopPropagation(); }}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className={clsx(styles.checkboxBox, checked || mixed && styles.checkboxActive)}>
        {mixed ? <span className={styles.checkboxDash} /> : checked ? <TableIcon size={12}><path d="m5 12 4 4L19 6" /></TableIcon> : null}
      </span>
    </label>
  );
}

function Tag({ name }: { name: string }): JSX.Element {
  const color = lookup(TAG_COLORS, name) ?? { base: "var(--ink-3)" };
  return (
    <span className={styles.tag} style={cssVars({ "--tag-base": color.base })}>
      {name}
    </span>
  );
}

function TagList({ tags }: { tags: string[] }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const available = container.clientWidth;
      const tagWidths = Array.from(measure.querySelectorAll<HTMLElement>("[data-tag-measure]"), (tag) => tag.offsetWidth);
      const moreWidth = measure.querySelector<HTMLElement>("[data-more-measure]")?.offsetWidth ?? 0;
      let used = 0;
      let count = 0;

      for (let index = 0; index < tagWidths.length; index += 1) {
        const nextUsed = used + (count > 0 ? 4 : 0) + (tagWidths[index] ?? 0);
        const hiddenAfter = tags.length - (index + 1);
        const totalWithOverflow = nextUsed + (hiddenAfter > 0 ? 4 + moreWidth : 0);
        if (totalWithOverflow > available) break;
        used = nextUsed;
        count += 1;
      }

      setVisibleCount(count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => { observer.disconnect(); };
  }, [tags]);

  const hiddenCount = tags.length - visibleCount;

  return (
    <div ref={containerRef} className={styles.tags} title={tags.join(", ")} aria-label={`Categories: ${tags.join(", ")}`}>
      <div ref={measureRef} className={styles.tagsMeasure} aria-hidden>
        {tags.map((tag) => <span key={tag} data-tag-measure><Tag name={tag} /></span>)}
        <span data-more-measure className={styles.moreTag}>+{tags.length}</span>
      </div>
      {tags.slice(0, visibleCount).map((tag) => <Tag key={tag} name={tag} />)}
      {hiddenCount > 0 && <span className={styles.moreTag}>+{hiddenCount}</span>}
    </div>
  );
}

function CalcCell(): JSX.Element {
  return (
    <span className={styles.calc}>
      <span className={styles.muted}>Calculating…</span>
      <span className={styles.pulse} />
    </span>
  );
}

function MiniSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={styles.switch}
      style={{ background: on ? "var(--accent)" : "var(--line-strong)" }}
    >
      <span
        className={styles.switchKnob}
        style={{ transform: on ? "translateX(12px)" : "translateX(0)", transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
      />
    </button>
  );
}

function HeaderCell({ label, icon, sortKey, sort, onSort, onResizeStart, resizing = false, className = "", selected = false, onPick }: {
  label: string;
  icon: React.ReactNode;
  sortKey?: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  onResizeStart: (event: React.PointerEvent<HTMLSpanElement>) => void;
  resizing?: boolean;
  className?: string;
  selected?: boolean;
  onPick?: (event: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <th className={clsx(styles.headerCell, selected && styles.colsel, className)}>
      {/* header click opens the property config; the arrow sorts */}
      <button type="button" className={styles.headerButton} onClick={onPick}>
        <span className={styles.headerIcon}>{icon}</span>
        <span className={styles.truncate}>{label}</span>
        {sortKey && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Sort by ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onSort(sortKey);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSort(sortKey);
              }
            }}
            className={clsx(styles.sort, sort.key === sortKey && styles.sortVisible)}
            style={{ transform: sort.key === sortKey && sort.dir === -1 ? "rotate(180deg)" : undefined }}
          >
            <TableIcon size={12}><path d="M12 5v14M5 12l7 7 7-7" /></TableIcon>
          </span>
        )}
      </button>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        className={clsx(styles.resizeHandle, resizing && styles.resizing)}
        onPointerDown={onResizeStart}
      />
    </th>
  );
}

/* config row inside the property popover */
function ConfigRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.configRow}>
      <span className={styles.configRowLabel}>{label}</span>
      {children}
    </div>
  );
}

function ConfigPicker({ label, options, selected, onSelect }: {
  label: string;
  options: { label: string; icon: React.ReactNode }[];
  selected: string;
  onSelect: (value: string) => void;
}): JSX.Element {
  return (
    <div role="menu" aria-label={label} className={styles.pickerMenu} style={{ animation: "pop-in 140ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}>
      <div className={styles.pickerLabel}>{label}</div>
      <GlideMenu className={styles.pickerList}>
        {options.map((option) => (
          <button
            key={option.label}
            data-glide-item
            type="button"
            role="menuitemradio"
            aria-checked={selected === option.label}
            onClick={() => { onSelect(option.label); }}
            className={styles.pickerItem}
          >
            <span className={styles.pickerItemIcon}>{option.icon}</span>
            <span className={styles.pickerItemText}>{option.label}</span>
            <span className={selected === option.label ? styles.toneInk : styles.invisible}>
              <TableIcon size={14} strokeWidth={2.2}><path d="m5 12 4 4L19 6" /></TableIcon>
            </span>
          </button>
        ))}
      </GlideMenu>
    </div>
  );
}

function InputPicker({ options, selected, onToggle }: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}): JSX.Element {
  return (
    <div role="menu" aria-label="Calculation inputs" className={clsx(styles.pickerMenu, styles.pickerWide)} style={{ animation: "pop-in 140ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}>
      <div className={styles.pickerLabel}>Use values from</div>
      <GlideMenu className={styles.pickerList}>
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <button
              key={option}
              data-glide-item
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={() => { onToggle(option); }}
              className={styles.pickerItem}
            >
              <span className={clsx(styles.inputCheck, checked ? styles.inputCheckOn : styles.inputCheckOff)}>
                <TableIcon size={11} strokeWidth={2.4}><path d="m5 12 4 4L19 6" /></TableIcon>
              </span>
              <span className={styles.pickerItemText}>{option}</span>
            </button>
          );
        })}
      </GlideMenu>
    </div>
  );
}

export interface RecordsTableProps {
  /** stretch the shell to fill its available space */
  fill?: boolean;
  variant?: string;
}

export function RecordsTable({ fill = false }: RecordsTableProps): JSX.Element {
  const rows = INITIAL_ROWS;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [actionColumnWidth, setActionColumnWidth] = useState(100);
  const [columnWidthsLocked, setColumnWidthsLocked] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<ColumnKey | null>(null);
  const initialColumnWidthsRef = useRef<Record<ColumnKey, number> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  /* property popover, anchored to the clicked header */
  const [prop, setProp] = useState<{ col: string; x: number; y: number } | null>(null);
  const [grounding, setGrounding] = useState(false);
  const [groundingHelpOpen, setGroundingHelpOpen] = useState(false);
  const [configMenu, setConfigMenu] = useState<"type" | "tool" | "inputs" | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, Partial<ColumnMeta>>>({});
  const [inputSelections, setInputSelections] = useState<Record<string, string[]>>({});
  const [pinnedColumns, setPinnedColumns] = useState<Set<string>>(new Set());
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState({ required: false, allowEmpty: true, confidence: false });
  /* + new-property menu */
  const [addOpen, setAddOpen] = useState<{ x: number; y: number } | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState<{ x: number; y: number } | null>(null);
  /* the added AI column and its lifecycle */
  const [aiAdded, setAiAdded] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [pendingOpenAi, setPendingOpenAi] = useState(false);
  const aiThRef = useRef<HTMLTableCellElement>(null);
  /* programmatic scrolls (revealing the new column) shouldn't close popovers */
  const ignoreScrollRef = useRef(false);
  /* a running calculation resolves rows one by one */
  const [calc, setCalc] = useState<{ col: string; resolved: number } | null>(null);

  /* Let the table fill its available space once, then capture those rendered
   * widths before paint. From that point on every column is explicit, so a
   * resize changes only the dragged column and the table's total width. */
  useLayoutEffect(() => {
    if (columnWidthsLocked || !tableRef.current) return;
    const headers = Array.from(tableRef.current.querySelectorAll<HTMLTableCellElement>("thead th"));
    if (headers.length < 6) return;
    const [h0, h1, h2, h3, h4] = headers;
    const hLast = headers[headers.length - 1];
    if (!h0 || !h1 || !h2 || !h3 || !h4 || !hLast) return;

    const measured: Record<ColumnKey, number> = {
      company: h0.getBoundingClientRect().width,
      categories: h1.getBoundingClientRect().width,
      last: h2.getBoundingClientRect().width,
      strength: h3.getBoundingClientRect().width,
      links: h4.getBoundingClientRect().width,
      ai: DEFAULT_COLUMN_WIDTHS.ai,
    };
    initialColumnWidthsRef.current = measured;
    setColumnWidths(measured);
    setActionColumnWidth(hLast.getBoundingClientRect().width);
    setColumnWidthsLocked(true);
  }, [columnWidthsLocked]);

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const value = sort.key === "name"
        ? a.name.localeCompare(b.name)
        : sort.key === "last"
          ? a.last.localeCompare(b.last)
          : STRENGTH[a.strength].rank - STRENGTH[b.strength].rank;
      return value * sort.dir;
    });
  }, [sort, rows]);

  /* stagger: one row resolves every beat */
  useEffect(() => {
    if (!calc) return;
    if (calc.resolved > visibleRows.length) {
      if (calc.col === AI_LABEL) setAiDone(true);
      setCalc(null);
      return;
    }
    const t = setTimeout(() => { setCalc((current) => (current ? { ...current, resolved: current.resolved + 1 } : current)); }, 110);
    return () => { clearTimeout(t); };
  }, [calc, visibleRows.length]);

  /* after adding the AI column, scroll it into view and open its config
   * anchored to the new header */
  useEffect(() => {
    if (!pendingOpenAi || !aiThRef.current) return;
    const scroller = aiThRef.current.closest(`.${String(styles.scroll)}`);
    if (scroller) {
      ignoreScrollRef.current = true;
      scroller.scrollLeft = scroller.scrollWidth;
    }
    const rect = aiThRef.current.getBoundingClientRect();
    setProp({ col: AI_LABEL, x: Math.min(rect.left, window.innerWidth - 336), y: rect.bottom + 6 });
    setPendingOpenAi(false);
  }, [pendingOpenAi, aiAdded]);

  /* click anywhere else closes popovers */
  useEffect(() => {
    if (!prop && !addOpen && !tableMenuOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-recpop]")) {
        setProp(null);
        setConfigMenu(null);
        setGroundingHelpOpen(false);
        setMoreSettingsOpen(false);
        setAddOpen(null);
        setTableMenuOpen(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); };
  }, [prop, addOpen, tableMenuOpen]);

  const openProp = (col: string) => (event: React.MouseEvent) => {
    const th = (event.currentTarget).closest("th");
    if (!th) return;
    setAddOpen(null);
    setTableMenuOpen(null);
    setConfigMenu(null);
    setGroundingHelpOpen(false);
    setMoreSettingsOpen(false);
    setProp((current) => {
      if (current?.col === col) return null;
      const rect = th.getBoundingClientRect();
      return { col, x: Math.min(rect.left, window.innerWidth - 336), y: rect.bottom + 6 };
    });
  };

  const isCalc = (col: string, index: number) => !!calc && calc.col === col && index >= calc.resolved;

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));
  const partiallySelected = !allSelected && visibleRows.some((row) => selected.has(row.id));

  const toggleSort = (key: SortKey) => { setSort((current) => current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }); };
  const startColumnResize = (key: ColumnKey, minWidth = 120) => (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setProp(null);
    setConfigMenu(null);
    setGroundingHelpOpen(false);
    setMoreSettingsOpen(false);
    setAddOpen(null);
    setTableMenuOpen(null);

    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setResizingColumn(key);

    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(minWidth, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [key]: width }));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
      setResizingColumn(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const toggleRow = (id: string) => { setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }); };
  const toggleAll = () => { setSelected((current) => {
    const next = new Set(current);
    if (allSelected) visibleRows.forEach((row) => next.delete(row.id));
    else visibleRows.forEach((row) => next.add(row.id));
    return next;
  }); };

  const metaBase = prop ? lookup(COLUMN_META, prop.col) : undefined;
  const meta: ColumnMeta | null = prop && metaBase ? { ...metaBase, ...lookup(columnOverrides, prop.col) } : null;
  const selectedInputs = prop && meta
    ? inputSelections[prop.col] ?? (meta.inputs !== undefined ? [meta.inputs] : [])
    : [];
  const tableWidth = columnWidths.company + columnWidths.categories + columnWidths.last + columnWidths.strength + columnWidths.links + (aiAdded ? columnWidths.ai : 0) + actionColumnWidth;

  return (
    <div className={clsx(styles.shell, fill && styles.fill)}>
      <div
        className={styles.scroll}
        tabIndex={0}
        aria-label="Companies table. Scroll horizontally and vertically to view all columns and records."
        onScroll={() => {
          if (ignoreScrollRef.current) {
            ignoreScrollRef.current = false;
            return;
          }
          setProp(null);
          setConfigMenu(null);
          setGroundingHelpOpen(false);
          setMoreSettingsOpen(false);
          setAddOpen(null);
          setTableMenuOpen(null);
        }}
      >
        <table ref={tableRef} className={styles.table} style={{ width: columnWidthsLocked ? tableWidth : "100%", minWidth: tableWidth }}>
          <colgroup>
            <col style={{ width: columnWidths.company }} />
            <col style={{ width: columnWidths.categories }} />
            <col style={{ width: columnWidths.last }} />
            <col style={{ width: columnWidths.strength }} />
            <col style={{ width: columnWidths.links }} />
            {aiAdded && <col style={{ width: columnWidths.ai }} />}
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={clsx(styles.headerCell, styles.stickyCell, prop?.col === "Company" && styles.colsel)}>
                <div className={styles.companyHeader} style={{ cursor: "pointer" }} onClick={(event) => { openProp("Company")(event); }}>
                  <Checkbox checked={allSelected} mixed={partiallySelected} onChange={toggleAll} label="Select all companies" />
                  <span>Company</span>
                </div>
                <span role="separator" aria-orientation="vertical" aria-label="Resize Company column" className={clsx(styles.resizeHandle, resizingColumn === "company" && styles.resizing)} onPointerDown={startColumnResize("company", 180)} />
              </th>
              <HeaderCell label="Categories" selected={prop?.col === "Categories"} onPick={openProp("Categories")} sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("categories")} resizing={resizingColumn === "categories"} icon={<TableIcon size={15}>{TYPE_GLYPHS["Multi select"]}</TableIcon>} />
              <HeaderCell label="Last interaction" selected={prop?.col === "Last interaction"} onPick={openProp("Last interaction")} sortKey="last" sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("last")} resizing={resizingColumn === "last"} icon={<TableIcon size={15}>{TYPE_GLYPHS.Date}</TableIcon>} />
              <HeaderCell label="Connection strength" selected={prop?.col === "Connection strength"} onPick={openProp("Connection strength")} sortKey="strength" sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("strength")} resizing={resizingColumn === "strength"} icon={<TableIcon size={15}>{TYPE_GLYPHS["Single select"]}</TableIcon>} />
              <HeaderCell label="Links" selected={prop?.col === "Links"} onPick={openProp("Links")} sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("links")} resizing={resizingColumn === "links"} icon={<TableIcon size={15}>{TYPE_GLYPHS.URL}</TableIcon>} />
              {aiAdded && (
                <th ref={aiThRef} className={clsx(styles.headerCell, prop?.col === AI_LABEL && styles.colsel)}>
                  <button type="button" className={styles.headerButton} onClick={openProp(AI_LABEL)}>
                    <span className={styles.headerIcon}><TableIcon size={15}>{TYPE_GLYPHS.Text}</TableIcon></span>
                    <span className={styles.truncate}>{AI_LABEL}</span>
                  </button>
                  <span role="separator" aria-orientation="vertical" aria-label={`Resize ${AI_LABEL} column`} className={clsx(styles.resizeHandle, resizingColumn === "ai" && styles.resizing)} onPointerDown={startColumnResize("ai")} />
                </th>
              )}
              <th className={styles.headerCell}>
                <div className={styles.headerActions}>
                  <button
                    type="button"
                    aria-label="New property"
                    data-recpop
                    onClick={(event) => {
                      setProp(null);
                      setTableMenuOpen(null);
                      const rect = event.currentTarget.getBoundingClientRect();
                      setAddOpen((current) => (current ? null : { x: Math.min(rect.left, window.innerWidth - 276), y: rect.bottom + 6 }));
                    }}
                    className={clsx(styles.iconBtn, styles.toneInk2)}
                  >
                    <TableIcon size={15} strokeWidth={2}><path d="M12 5v14M5 12h14" /></TableIcon>
                  </button>
                  <button
                    type="button"
                    aria-label="Table options"
                    aria-expanded={!!tableMenuOpen}
                    data-recpop
                    onClick={(event) => {
                      setProp(null);
                      setAddOpen(null);
                      const rect = event.currentTarget.getBoundingClientRect();
                      setTableMenuOpen((current) => current ? null : {
                        x: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228)),
                        y: rect.bottom + 6,
                      });
                    }}
                    className={clsx(styles.iconBtn, styles.toneInk3)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          {/* data cells stay silent — the papery link/flick sound is too much when scanning rows */}
          <tbody data-sound-silent>
            {visibleRows.map((row, index) => {
              const selectedRow = selected.has(row.id);
              const strength = STRENGTH[row.strength];
              return <tr key={row.id} className={clsx(styles.row, selectedRow && styles.rowSelected)}>
                <td className={clsx(styles.cell, styles.stickyCell, styles.companyCell, prop?.col === "Company" && styles.colsel)}><span className={styles.rownum}>{index + 1}</span><Checkbox checked={selectedRow} onChange={() => { toggleRow(row.id); }} label={`Select ${row.name}`} /><span className={styles.companyMark}>{row.name.slice(0, 1).toUpperCase()}</span><a href={row.website !== undefined ? `https://${row.website}` : "#"} onClick={(event) => { if (row.website === undefined) event.preventDefault(); }} title={row.name} className={clsx(styles.companyName, row.website !== undefined && styles.hasLink)}>{row.name}</a></td>
                <td className={clsx(styles.cell, prop?.col === "Categories" && styles.colsel)}>{isCalc("Categories", index) ? <CalcCell /> : <TagList tags={row.tags} />}</td>
                <td className={clsx(styles.cell, row.last === "No contact" && styles.muted, prop?.col === "Last interaction" && styles.colsel)}>{isCalc("Last interaction", index) ? <CalcCell /> : row.last}</td>
                <td className={clsx(styles.cell, prop?.col === "Connection strength" && styles.colsel)}>{isCalc("Connection strength", index) ? <CalcCell /> : <span className={styles.strength}><span className={styles.strengthDot} style={{ background: strength.color }} />{strength.label}</span>}</td>
                <td className={clsx(styles.cell, prop?.col === "Links" && styles.colsel)}>{isCalc("Links", index) ? <CalcCell /> : row.website !== undefined ? <a className={styles.link} href={`https://${row.website}`} title={row.website} target="_blank" rel="noreferrer"><span className={styles.linkLabel}>{row.website}</span><TableIcon size={12}><path d="M14 5h5v5M19 5l-8 8" /></TableIcon></a> : <span className={styles.muted}>—</span>}</td>
                {aiAdded && (
                  <td className={clsx(styles.cell, prop?.col === AI_LABEL && styles.colsel)}>
                    {calc?.col === AI_LABEL ? (index < calc.resolved ? competitorsFor(index) : <CalcCell />) : aiDone ? competitorsFor(index) : <span className={styles.muted}>—</span>}
                  </td>
                )}
                <td className={styles.cell} />
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr className={styles.calculationRow}>
              <td className={clsx(styles.cell, styles.stickyCell)}>
                <span className={clsx(styles.footerValue, styles.calculationLabel)}><span className={styles.calculationNumber}>{rows.length}</span> count</span>
              </td>
              <td className={styles.cell}>
                <button type="button" className={styles.addCalculation}><TableIcon size={15}><path d="M12 5v14M5 12h14" /></TableIcon>Add calculation</button>
              </td>
              <td className={clsx(styles.cell, styles.muted)}><span className={styles.footerValue}>—</span></td>
              <td className={styles.cell}>
                <span className={clsx(styles.footerValue, styles.average)}><span className={styles.strengthDot} style={{ background: "var(--orange)" }} />{Math.round(rows.reduce((sum, row) => sum + STRENGTH[row.strength].rank, 0) / rows.length / 3 * 100)}% average</span>
              </td>
              <td className={styles.cell}><span className={clsx(styles.footerValue, styles.muted)}>{rows.filter((row) => row.website !== undefined).length} links</span></td>
              {aiAdded && <td className={clsx(styles.cell, styles.muted)}><span className={styles.footerValue}>{aiDone ? `${String(rows.length)} filled` : "—"}</span></td>}
              <td className={styles.cell} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── property configuration popover ─────────────────── */}
      {prop && meta && (
        <div
          data-recpop
          className={styles.propPopover}
          style={{ top: prop.y, left: prop.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
        >
          <div className={styles.propTitle}>{prop.col}</div>

          <ConfigRow label="Type">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "type"}
              onClick={() => { setConfigMenu((current) => current === "type" ? null : "type"); }}
              className={styles.configBtn}
            >
              <span className={styles.toneInk2}><TableIcon size={14}>{TYPE_GLYPHS[meta.type] ?? TYPE_GLYPHS.Text}</TableIcon></span>
              {meta.type}
              <span className={styles.toneInk3}><TableIcon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></TableIcon></span>
            </button>
            {configMenu === "type" && (
              <ConfigPicker
                label="Property type"
                selected={meta.type}
                options={NEW_PROPERTY_TYPES.map((type) => ({ label: type, icon: <TableIcon size={15}>{TYPE_GLYPHS[type]}</TableIcon> }))}
                onSelect={(type) => {
                  setColumnOverrides((current) => ({ ...current, [prop.col]: { ...current[prop.col], type } }));
                  setConfigMenu(null);
                }}
              />
            )}
          </ConfigRow>
          <ConfigRow label="Tool">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "tool"}
              onClick={() => { setConfigMenu((current) => current === "tool" ? null : "tool"); }}
              className={styles.configBtn}
            >
              <span className={meta.toolKind === "model" ? styles.toneAccent : styles.toneInk2}>
                {meta.toolKind === "model"
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{TOOL_GLYPHS.model}</svg>
                  : <TableIcon size={14}>{TOOL_GLYPHS[meta.toolKind]}</TableIcon>}
              </span>
              {meta.tool}
              <span className={styles.toneInk3}><TableIcon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></TableIcon></span>
            </button>
            {configMenu === "tool" && (
              <ConfigPicker
                label="Model"
                selected={meta.tool}
                options={MODEL_OPTIONS.map((model) => ({
                  label: model,
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{TOOL_GLYPHS.model}</svg>,
                }))}
                onSelect={(tool) => {
                  setColumnOverrides((current) => ({ ...current, [prop.col]: { ...current[prop.col], tool, toolKind: "model" } }));
                  setConfigMenu(null);
                }}
              />
            )}
          </ConfigRow>
          <ConfigRow label="Grounding">
            <span className={styles.groundingWrap}>
              <MiniSwitch label="Grounding" on={grounding} onToggle={() => { setGrounding((current) => !current); }} />
              <button
                type="button"
                aria-label="About grounding"
                aria-expanded={groundingHelpOpen}
                onClick={() => { setGroundingHelpOpen((open) => !open); }}
                className={styles.helpBtn}
              >
                <TableIcon size={13}><g><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></g></TableIcon>
              </button>
            </span>
            {groundingHelpOpen && (
              <div className={styles.groundingTip} role="status">
                Grounding lets the model verify generated values against connected sources.
              </div>
            )}
          </ConfigRow>
          <ConfigRow label="Inputs">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "inputs"}
              onClick={() => { setConfigMenu((current) => current === "inputs" ? null : "inputs"); }}
              className={styles.inputsBtn}
            >
              {selectedInputs.length ? (
                <span className={styles.inputChips}>
                  {selectedInputs.slice(0, 2).map((input) => (
                    <span key={input} className={styles.inputChip}>{input}</span>
                  ))}
                  {selectedInputs.length > 2 && <span className={styles.inputMore}>+{selectedInputs.length - 2}</span>}
                </span>
              ) : (
                <span>Select inputs</span>
              )}
              <span className={styles.inputsChevron}><TableIcon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></TableIcon></span>
            </button>
            {configMenu === "inputs" && (
              <InputPicker
                selected={selectedInputs}
                options={INPUT_OPTIONS.filter((input) => input !== prop.col)}
                onToggle={(input) => {
                  setInputSelections((current) => {
                    const existing = current[prop.col] ?? (meta.inputs !== undefined ? [meta.inputs] : []);
                    const next = existing.includes(input) ? existing.filter((item) => item !== input) : [...existing, input];
                    return { ...current, [prop.col]: next };
                  });
                }}
              />
            )}
          </ConfigRow>

          {/* prompt — @-mention chips inline */}
          <div
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={`${prop.col} calculation prompt`}
            aria-multiline="true"
            spellCheck
            className={styles.promptBox}
          >
            {meta.prompt ? (
              <span className={styles.toneInk}>
                {meta.prompt.before}
                {meta.prompt.chip !== undefined && <span contentEditable={false} className={styles.promptChip}>{meta.prompt.chip}</span>}
                {meta.prompt.after}
              </span>
            ) : (
              <span className={styles.toneInk3}>Set a prompt (press @ to mention an input)</span>
            )}
          </div>

          <button
            type="button"
            disabled={!!calc}
            onClick={() => {
              setCalc({ col: prop.col, resolved: 0 });
              setProp(null);
            }}
            className={styles.goBtn}
          >
            <TableIcon size={14} strokeWidth={1.9}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></TableIcon>
            Go calculate
          </button>

          <GlideMenu className={styles.glideBottom} highlightClassName={styles.glideHighlight}>
            <button
              data-glide-item
              type="button"
              aria-pressed={pinnedColumns.has(prop.col)}
              onClick={() => { setPinnedColumns((current) => {
                const next = new Set(current);
                if (next.has(prop.col)) next.delete(prop.col); else next.add(prop.col);
                return next;
              }); }}
              className={styles.menuRow}
            >
              <span className={pinnedColumns.has(prop.col) ? styles.toneAccent : styles.toneInk2}><TableIcon size={15}><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3-1-7z" /></TableIcon></span>
              {pinnedColumns.has(prop.col) ? "Unpin" : "Pin"}
            </button>
            <button
              data-glide-item
              type="button"
              aria-expanded={moreSettingsOpen}
              onClick={() => { setMoreSettingsOpen((open) => !open); }}
              className={styles.menuRow}
            >
              <span className={moreSettingsOpen ? styles.toneInk : styles.toneInk2}><TableIcon size={15}><g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></g></TableIcon></span>
              <span className={styles.menuRowGrow}>More settings</span>
              <span className={clsx(styles.toneInk3, styles.menuChevron, moreSettingsOpen && styles.menuChevronOpen)}><TableIcon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></TableIcon></span>
            </button>
            {prop.col === AI_LABEL && (
              <button
                data-glide-item
                type="button"
                onClick={() => {
                  setAiAdded(false);
                  setAiDone(false);
                  setProp(null);
                }}
                className={styles.menuRow}
              >
                <span className={styles.toneInk2}><TableIcon size={15}><g><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a16.3 16.3 0 0 1-2.1 3M6.6 6.6A16 16 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></g></TableIcon></span>
                Hide from view
              </button>
            )}
          </GlideMenu>

          {moreSettingsOpen && (
            <div className={styles.behaviorSection} style={{ animation: "fade-up 160ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <div className={styles.behaviorLabel}>Behavior</div>
              <ConfigRow label="Required value">
                <MiniSwitch label="Required value" on={advancedSettings.required} onToggle={() => { setAdvancedSettings((current) => ({ ...current, required: !current.required })); }} />
              </ConfigRow>
              <ConfigRow label="Allow empty results">
                <MiniSwitch label="Allow empty results" on={advancedSettings.allowEmpty} onToggle={() => { setAdvancedSettings((current) => ({ ...current, allowEmpty: !current.allowEmpty })); }} />
              </ConfigRow>
              <ConfigRow label="Show confidence">
                <MiniSwitch label="Show confidence" on={advancedSettings.confidence} onToggle={() => { setAdvancedSettings((current) => ({ ...current, confidence: !current.confidence })); }} />
              </ConfigRow>
            </div>
          )}
        </div>
      )}

      {/* ── new property type menu ─────────────────────────── */}
      {addOpen && (
        <div
          data-recpop
          className={styles.addPopover}
          style={{ top: addOpen.y, left: addOpen.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
        >
          <div className={styles.menuTitle}>New property</div>
          <GlideMenu className={styles.pickerList}>
            {NEW_PROPERTY_TYPES.map((type) => (
              <button
                key={type}
                data-glide-item
                type="button"
                onClick={() => {
                  setAddOpen(null);
                  setAiDone(false);
                  setAiAdded(true);
                  setPendingOpenAi(true);
                }}
                className={styles.addRow}
              >
                <span className={styles.toneInk2}><TableIcon size={15}>{TYPE_GLYPHS[type]}</TableIcon></span>
                {type}
              </button>
            ))}
          </GlideMenu>
        </div>
      )}

      {/* ── table options menu ─────────────────────────────── */}
      {tableMenuOpen && (
        <div
          data-recpop
          className={styles.tableMenu}
          style={{ top: tableMenuOpen.y, left: tableMenuOpen.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top right" }}
        >
          <div className={styles.menuTitle}>Table options</div>
          <GlideMenu className={styles.pickerList}>
            <button
              data-glide-item
              type="button"
              onClick={() => {
                const position = tableMenuOpen;
                setTableMenuOpen(null);
                setAddOpen({ x: Math.min(position.x, window.innerWidth - 276), y: position.y });
              }}
              className={styles.addRow}
            >
              <span className={styles.toneInk2}><TableIcon size={15} strokeWidth={2}><path d="M12 5v14M5 12h14" /></TableIcon></span>
              Add property
            </button>
            <button
              data-glide-item
              type="button"
              onClick={() => {
                setColumnWidths({ company: 220, categories: 220, last: 155, strength: 180, links: 160, ai: 200 });
                setTableMenuOpen(null);
              }}
              className={styles.addRow}
            >
              <span className={styles.toneInk2}><TableIcon size={15}><path d="M4 8h16M7 4 3 8l4 4M17 4l4 4-4 4M4 16h16" /></TableIcon></span>
              Compact columns
            </button>
            <button
              data-glide-item
              type="button"
              onClick={() => {
                setColumnWidths({ ...(initialColumnWidthsRef.current ?? DEFAULT_COLUMN_WIDTHS) });
                setTableMenuOpen(null);
              }}
              className={styles.addRow}
            >
              <span className={styles.toneInk2}><TableIcon size={15}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6" /></TableIcon></span>
              Reset column widths
            </button>
            <div className={styles.menuDivider} />
            <button
              data-glide-item
              type="button"
              onClick={() => {
                setSelected(new Set());
                setTableMenuOpen(null);
              }}
              className={styles.addRow}
            >
              <span className={styles.toneInk2}><TableIcon size={15}><path d="M5 5l14 14M19 5 5 19" /></TableIcon></span>
              Clear selection
            </button>
          </GlideMenu>
        </div>
      )}
    </div>
  );
}
