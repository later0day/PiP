import clsx from "clsx";
import { type JSX, useState } from "react";
import { lookup } from "../../lib/lookup";
import styles from "./FilterTable.module.css";

// FilterTable — beautifului tables #2. Status chips directly filter the task
// table; unmatched rows collapse via an animated grid-rows/opacity transition.
// Ported verbatim from the real source; Tailwind → CSS Modules over DSH vars.

type Status = "todo" | "progress" | "done";

const FILTERS = [
  { key: "all", label: "All", count: 5 },
  { key: "todo", label: "To do", dot: "#f09a2f", count: 2 },
  { key: "progress", label: "In Progress", dot: "#16a6c7", count: 2 },
  { key: "done", label: "Completed", dot: "#25a878", count: 1 },
] satisfies { key: "all" | Status; label: string; dot?: string; count: number }[];

const ROWS = [
  { task: "Restock mango sorbet", date: "Dec 03", status: "todo", owner: "Mango Moon Gelato" },
  { task: "Churn black sesame", date: "Sep 22", status: "progress", owner: "Kumo Creamery" },
  { task: "Print summer menu", date: "Jan 02", status: "todo", owner: "Coral Coast Sorbet" },
  { task: "Taste-test batch 42", date: "Nov 08", status: "progress", owner: "Maple Orbit" },
  { task: "Order waffle cones", date: "Apr 14", status: "done", owner: "Aurora Scoops" },
] satisfies { task: string; date: string; status: Status; owner: string }[];

const PILLS = {
  todo: { label: "To do", cls: styles.statusTodo },
  progress: { label: "In Progress", cls: styles.statusProgress },
  done: { label: "Completed", cls: styles.statusDone },
} satisfies Record<Status, { label: string; cls: string | undefined }>;

export function FilterTable(): JSX.Element {
  const [filter, setFilter] = useState<"all" | Status>("all");

  return (
    <div className={styles.shell}>
      {/* filter chips */}
      <div className={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => { setFilter(f.key); }}
              className={clsx(styles.chip, active && styles.chipActive)}
            >
              {f.dot !== undefined && <span className={styles.chipDot} style={{ background: f.dot }} />}
              {f.label}
              <span className={clsx(styles.chipCount, active && styles.chipCountActive)}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div aria-label="Scrollable task table" className={styles.table} role="region" tabIndex={0}>
        <div className={styles.inner}>
          <div className={clsx(styles.grid, styles.headRow)}>
            <span className={clsx(styles.headCell, styles.cellBorder)}>Task name</span>
            <span className={clsx(styles.headCell, styles.cellBorder)}>Date</span>
            <span className={clsx(styles.headCell, styles.cellBorder)}>Status</span>
            <span className={styles.headCell}>Advisor</span>
          </div>
          {ROWS.map((row) => {
            const shown = filter === "all" || row.status === filter;
            const pill = lookup(PILLS, row.status) ?? PILLS.todo;
            return (
              <div
                key={row.task}
                className={styles.rowWrap}
                style={{ gridTemplateRows: shown ? "1fr" : "0fr", opacity: shown ? 1 : 0 }}
              >
                <div className={styles.rowClip}>
                  <div className={clsx(styles.grid, styles.bodyRow)}>
                    <span className={clsx(styles.bodyCell, styles.cellBorder, styles.taskCell)}>
                      <span className={styles.taskName}>{row.task}</span>
                    </span>
                    <span className={clsx(styles.bodyCell, styles.cellBorder, styles.dateCell)}>
                      {row.date}
                    </span>
                    <span className={clsx(styles.bodyCell, styles.cellBorder)}>
                      <span className={clsx(styles.pill, pill.cls)}>{pill.label}</span>
                    </span>
                    <span className={clsx(styles.bodyCell, styles.ownerCell)}>
                      <span className={styles.ownerName}>{row.owner}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
