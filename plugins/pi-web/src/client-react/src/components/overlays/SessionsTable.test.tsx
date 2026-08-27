import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import type { AppState } from "@client/appState";
import { initialAppState } from "@client/appState";
import type { SessionInfo } from "@shared/apiTypes";
import { AppStateContext } from "../../state/appStore";
import { SessionsTable } from "./SessionsTable";

const session = (over: Partial<SessionInfo> & Pick<SessionInfo, "id">): SessionInfo => ({
  cwd: "/root/ws",
  path: `/root/ws/${over.id}.json`,
  created: "2026-08-20T00:00:00Z",
  modified: "2026-08-20T00:00:00Z",
  messageCount: 0,
  firstMessage: "",
  ...over,
});

const SESSIONS: SessionInfo[] = [
  session({ id: "alpha", name: "Alpha", modified: "2026-08-27T10:00:00Z", messageCount: 12 }),
  session({ id: "beta", name: "Beta", modified: "2026-08-25T10:00:00Z", messageCount: 3 }),
  session({ id: "gamma", name: "Gamma", modified: "2026-08-26T10:00:00Z", messageCount: 7, archived: true, archivedAt: "2026-08-26T12:00:00Z" }),
];

const ARCHIVED_ONLY = session({ id: "gamma", name: "Gamma", modified: "2026-08-26T10:00:00Z", messageCount: 7, archived: true, archivedAt: "2026-08-26T12:00:00Z" });

function withState(ui: ReactElement, over: Partial<AppState> = {}): ReactElement {
  const state: AppState = { ...initialAppState(), sessions: SESSIONS, ...over };
  return <AppStateContext.Provider value={state}>{ui}</AppStateContext.Provider>;
}

// Ports SessionsTable to RTL: the RecordsTable (#12) sortable columns + the
// FilterTable (#13) status chips over the live session list from AppState. Chips
// filter rows and carry counts; Name/Updated/Messages headers toggle sort;
// picking a row navigates + closes.
describe("SessionsTable", () => {
  it("lists every session with a status pill and count summary", () => {
    render(withState(<SessionsTable onPick={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByRole("dialog", { name: "会话" })).toBeInTheDocument();
    expect(screen.getByText("此工作区中有 3 个会话。")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("filters to archived sessions via the status chip", async () => {
    const user = userEvent.setup();
    render(withState(<SessionsTable onPick={vi.fn()} onClose={vi.fn()} />));
    await user.click(screen.getByRole("button", { name: /已归档/ }));
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("shows an empty message when a filter matches nothing", async () => {
    const user = userEvent.setup();
    // Only an archived session exists, so the Active filter yields no rows.
    render(withState(<SessionsTable onPick={vi.fn()} onClose={vi.fn()} />, { sessions: [ARCHIVED_ONLY] }));
    await user.click(screen.getByRole("button", { name: /活动/ }));
    expect(screen.getByText("没有会话匹配此筛选。")).toBeInTheDocument();
  });

  it("sorts by messages when the Messages header is clicked", async () => {
    const user = userEvent.setup();
    render(withState(<SessionsTable onPick={vi.fn()} onClose={vi.fn()} />));
    await user.click(screen.getByRole("button", { name: /消息数/ }));
    const header = screen.getByRole("columnheader", { name: /消息数/ });
    // First click on a numeric column sorts descending (dir -1).
    expect(header).toHaveAttribute("aria-sort", "descending");
    const rows = screen.getAllByRole("row").filter((row) => within(row).queryByText(/Alpha|Beta|Gamma/) !== null);
    const firstRow = rows[0];
    expect(firstRow).not.toBeUndefined();
    if (firstRow === undefined) return;
    expect(within(firstRow).getByText(/Alpha|Beta|Gamma/).textContent).toBe("Alpha");
  });

  it("picks a row and closes the overlay", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn<(id: string) => void>();
    const onClose = vi.fn<() => void>();
    render(withState(<SessionsTable onPick={onPick} onClose={onClose} />));
    await user.click(screen.getByText("Alpha"));
    expect(onPick).toHaveBeenCalledWith("alpha");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
