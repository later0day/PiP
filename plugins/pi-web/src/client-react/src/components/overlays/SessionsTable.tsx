import { type JSX, useMemo, useState } from "react";
import clsx from "clsx";
import { ModalSurface } from "../../primitives";
import {
  buildSessionTableRows,
  filterSessionTableRows,
  formatSessionModified,
  sessionFilterCounts,
  sortSessionTableRows,
  type SessionFilterKey,
  type SessionSortKey,
  type SessionStatusCategory,
  type SessionTableRow,
  type SortDir,
} from "../../state/sessionsTableModel";
import { useAppState } from "../../state/appStore";
import styles from "./SessionsTable.module.css";

// SessionsTable — the real-data surface for beautifului RecordsTable (#12,
// sortable columns) + FilterTable (#13, status-chip filtering), over the live
// session list for the selected workspace. Status chips (All/Active/Idle/
// Archived) filter rows; the Name/Updated/Messages headers sort (click toggles
// direction). Picking a row navigates to that session and closes the overlay.
// All categorize/filter/sort logic lives in the pure sessionsTableModel; this
// component owns only the filter + sort UI state, on the shared ModalSurface
// with the DSH skin. Read-only: no archive/delete here — those stay on the
// nav's session list + SessionCleanupDialog.

const FILTERS: readonly { key: SessionFilterKey; label: string; dot?: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "活动", dot: "var(--green)" },
  { key: "idle", label: "空闲", dot: "var(--orange)" },
  { key: "archived", label: "已归档", dot: "var(--ink-3)" },
];

const CATEGORY_PILL: Record<SessionStatusCategory, { label: string; cls: string | undefined }> = {
  active: { label: "活动", cls: styles.pillActive },
  idle: { label: "空闲", cls: styles.pillIdle },
  archived: { label: "已归档", cls: styles.pillArchived },
};

const COLUMNS: readonly { key: SessionSortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "会话" },
  { key: "modified", label: "更新时间", align: "right" },
  { key: "messages", label: "消息数", align: "right" },
];

export interface SessionsTableProps {
  onPick: (sessionId: string) => void;
  onClose: () => void;
}

export function SessionsTable({ onPick, onClose }: SessionsTableProps): JSX.Element {
  const state = useAppState();
  const [filter, setFilter] = useState<SessionFilterKey>("all");
  const [sort, setSort] = useState<{ key: SessionSortKey; dir: SortDir }>({ key: "modified", dir: -1 });

  const rows = useMemo(
    () => buildSessionTableRows(state.sessions, state.sessionStatuses, state.sessionActivities),
    [state.sessions, state.sessionStatuses, state.sessionActivities],
  );
  const counts = useMemo(() => sessionFilterCounts(rows), [rows]);
  const visible = useMemo(
    () => sortSessionTableRows(filterSessionTableRows(rows, filter), sort.key, sort.dir),
    [rows, filter, sort],
  );

  const toggleSort = (key: SessionSortKey): void => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  };

  const workspaceLabel = state.selectedWorkspace?.label ?? "此工作区";

  return (
    <ModalSurface onClose={onClose} label="会话" className={styles.surface}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>会话</span>
            <h1>浏览会话</h1>
          </div>
          <button type="button" className={styles.close} title="关闭会话" aria-label="关闭会话" onClick={onClose}>
            ×
          </button>
        </header>
        <div className={styles.body}>
          <p className={styles.intro}>
            {rows.length === 0
              ? `${workspaceLabel}中暂无会话。`
              : `${workspaceLabel}中有 ${String(rows.length)} 个会话。`}
          </p>

          <div className={styles.chips} role="group" aria-label="按状态筛选">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  className={clsx(styles.chip, active && styles.chipActive)}
                  onClick={() => { setFilter(f.key); }}
                >
                  {f.dot !== undefined && <span className={styles.chipDot} style={{ background: f.dot }} />}
                  {f.label}
                  <span className={clsx(styles.chipCount, active && styles.chipCountActive)}>{counts[f.key]}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.tableScroll} role="region" aria-label="会话表" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => {
                    const sorted = sort.key === col.key;
                    return (
                      <th key={col.key} className={clsx(col.align === "right" && styles.right)} aria-sort={sorted ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                        <button type="button" className={styles.headerButton} onClick={() => { toggleSort(col.key); }}>
                          {col.label}
                          <span className={clsx(styles.caret, sorted && styles.caretActive)} aria-hidden="true">
                            {sorted ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className={styles.empty}>
                      没有会话匹配此筛选。
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => renderRow(row, () => {
                    onPick(row.session.id);
                    onClose();
                  }))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModalSurface>
  );
}

function renderRow(row: SessionTableRow, onPick: () => void): JSX.Element {
  const pill = CATEGORY_PILL[row.category];
  return (
    <tr key={row.session.id} className={styles.row} onClick={onPick} tabIndex={0} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPick();
      }
    }}>
      <td className={styles.nameCell}>
        <span className={styles.name} title={row.label}>
          {row.label}
        </span>
        <span className={clsx(styles.pill, pill.cls)}>{pill.label}</span>
      </td>
      <td className={styles.right}>{formatSessionModified(row.session)}</td>
      <td className={styles.right}>{row.session.messageCount}</td>
    </tr>
  );
}
