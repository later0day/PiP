import { type JSX, useState } from "react";
import { GlideMenu } from "../../primitives";
import styles from "./SearchList.module.css";

// SearchList — beautifului command search with live filtering. An input row with
// clear action + a results/empty state, rows highlighted by the GlideMenu atom.
// Ported verbatim; Tailwind → CSS Modules over DSH vars; aria labels preserved.
// Keyframe fade-in ships globally in bui-dsh-bridge.css.

const ITEMS = [
  "Forecast summer demand",
  "Find waffle cone suppliers",
  "Compare seasonal flavors",
  "Draft flavor launch plan",
  "Check cold-chain status",
  "Audit sugar costs",
  "Retire low sellers",
];

export interface SearchListProps {
  /** override the searchable command list */
  items?: string[];
}

export function SearchList({ items = ITEMS }: SearchListProps): JSX.Element {
  const [query, setQuery] = useState("");
  const results = query
    ? items.filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    : items.slice(0, 5);
  const empty = query.length > 2 && results.length === 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* input row */}
        <div className={styles.inputRow}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="2"
            strokeLinecap="round"
            className={styles.searchIcon}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
            placeholder="Search flavors…"
            aria-label="Search flavors"
            className={styles.input}
          />
          {query && (
            <button
              aria-label="Clear search"
              type="button"
              onClick={() => { setQuery(""); }}
              className={styles.clear}
              style={{ animation: "fade-in 150ms ease-out both" }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* results / empty state */}
        {empty ? (
          <div className={styles.emptyState} style={{ animation: "fade-in 250ms ease-out both" }}>
            <span className={styles.emptyIcon}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <span className={styles.emptyTitle}>No results found</span>
            <span className={styles.emptyHint}>Adjust your search to try again</span>
          </div>
        ) : (
          <div className={styles.results}>
            <GlideMenu className={styles.resultList} highlightClassName={styles.glideHighlight}>
              {results.map((item) => (
                <button
                  key={item}
                  data-menu-row
                  data-glide-item
                  type="button"
                  onClick={() => { setQuery(item); }}
                  className={styles.resultRow}
                  style={{ animation: "fade-in 200ms ease-out both" }}
                >
                  {item}
                </button>
              ))}
            </GlideMenu>
          </div>
        )}
      </div>
    </div>
  );
}
