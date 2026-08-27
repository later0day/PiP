import type { SessionActivity, SessionInfo, SessionStatus } from "@shared/apiTypes";
import { isSessionActive } from "@shared/activity";
import { shortSessionId } from "@client/sessionLabels";

// sessionsTableModel — pure categorize/filter/sort helpers behind the
// SessionsTable overlay (beautifului RecordsTable #12 sortable columns +
// FilterTable #13 status chips, over live SessionInfo[]). Framework-agnostic so
// it stays unit-testable and mirrors the legacy SessionList's status/label
// derivations (isSessionActive, shortSessionId) without forking them.

export type SessionStatusCategory = "active" | "idle" | "archived";
export type SessionFilterKey = "all" | SessionStatusCategory;
export type SessionSortKey = "name" | "modified" | "messages";
export type SortDir = 1 | -1;

export interface SessionTableRow {
  session: SessionInfo;
  label: string;
  category: SessionStatusCategory;
  modifiedMs: number;
}

export function sessionRowLabel(session: SessionInfo): string {
  const name = (session.name ?? "").trim();
  if (name !== "") return name;
  const first = session.firstMessage.trim();
  return first !== "" ? first : shortSessionId(session.id);
}

export function sessionStatusCategory(
  session: SessionInfo,
  status: SessionStatus | undefined,
  activity: SessionActivity | undefined,
): SessionStatusCategory {
  if (session.archived === true) return "archived";
  return isSessionActive(status, activity) ? "active" : "idle";
}

function modifiedMs(session: SessionInfo): number {
  const parsed = Date.parse(session.modified);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildSessionTableRows(
  sessions: readonly SessionInfo[],
  statuses: Record<string, SessionStatus>,
  activities: Record<string, SessionActivity>,
): SessionTableRow[] {
  return sessions.map((session) => ({
    session,
    label: sessionRowLabel(session),
    category: sessionStatusCategory(session, statuses[session.id], activities[session.id]),
    modifiedMs: modifiedMs(session),
  }));
}

export function sessionFilterCounts(rows: readonly SessionTableRow[]): Record<SessionFilterKey, number> {
  const counts: Record<SessionFilterKey, number> = { all: rows.length, active: 0, idle: 0, archived: 0 };
  for (const row of rows) counts[row.category] += 1;
  return counts;
}

export function filterSessionTableRows(rows: readonly SessionTableRow[], filter: SessionFilterKey): SessionTableRow[] {
  return filter === "all" ? [...rows] : rows.filter((row) => row.category === filter);
}

export function sortSessionTableRows(
  rows: readonly SessionTableRow[],
  key: SessionSortKey,
  dir: SortDir,
): SessionTableRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp: number;
    if (key === "name") cmp = a.label.localeCompare(b.label);
    else if (key === "modified") cmp = a.modifiedMs - b.modifiedMs;
    else cmp = a.session.messageCount - b.session.messageCount;
    // Stable tiebreak on id so equal keys keep a deterministic order.
    if (cmp === 0) cmp = a.session.id.localeCompare(b.session.id);
    return cmp * dir;
  });
  return sorted;
}

export function formatSessionModified(session: SessionInfo, now: number = Date.now()): string {
  const ms = modifiedMs(session);
  if (ms === 0) return "—";
  const diff = Math.max(0, now - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${String(Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${String(Math.floor(diff / hour))} 小时前`;
  if (diff < 7 * day) return `${String(Math.floor(diff / day))} 天前`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
