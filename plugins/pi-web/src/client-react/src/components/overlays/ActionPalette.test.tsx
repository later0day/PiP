import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppAction } from "@client/actions";
import { ActionPalette, filterActionPaletteActions } from "./ActionPalette";

const action = (over: Partial<AppAction> & Pick<AppAction, "id" | "title">): AppAction => ({
  run: () => undefined,
  ...over,
});

const ACTIONS: AppAction[] = [
  action({ id: "new", title: "New chat", description: "Start a fresh session", group: "Session" }),
  action({ id: "theme", title: "Change appearance", shortcut: "mod+shift+t" }),
  action({ id: "danger", title: "Delete workspace", enabled: false, disabledReason: "Not permitted here" }),
  action({ id: "hidden", title: "Hidden action", enabled: false }),
];

// Ports ActionPalette.test.ts to RTL: the pure filter (hides fully-disabled
// actions, keeps disabled-with-reason, matches across fields), plus the
// component's search, roving keyboard nav + Enter, disabled-row guard, and click.
describe("filterActionPaletteActions", () => {
  it("hides disabled actions without a reason but keeps disabled-with-reason", () => {
    const result = filterActionPaletteActions(ACTIONS, "");
    expect(result.map((a) => a.id)).toEqual(["new", "theme", "danger"]);
  });

  it("matches the query across title, description, group, and shortcut", () => {
    expect(filterActionPaletteActions(ACTIONS, "fresh").map((a) => a.id)).toEqual(["new"]);
    expect(filterActionPaletteActions(ACTIONS, "session").map((a) => a.id)).toEqual(["new"]);
    expect(filterActionPaletteActions(ACTIONS, "permitted").map((a) => a.id)).toEqual(["danger"]);
  });
});

describe("ActionPalette", () => {
  it("focuses the search field and lists the visible actions", () => {
    render(<ActionPalette actions={ACTIONS} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText("搜索操作…")).toHaveFocus();
    expect(screen.getByRole("button", { name: /New chat/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hidden action/ })).not.toBeInTheDocument();
  });

  it("filters as the query changes and shows an empty state", async () => {
    const user = userEvent.setup();
    render(<ActionPalette actions={ACTIONS} onRun={vi.fn()} onCancel={vi.fn()} />);
    const search = screen.getByPlaceholderText("搜索操作…");
    await user.type(search, "appearance");
    expect(screen.getByRole("button", { name: /Change appearance/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New chat/ })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("未找到操作。")).toBeInTheDocument();
  });

  it("runs the roving-selected action with Enter", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn<(a: AppAction) => void>();
    render(<ActionPalette actions={ACTIONS} onRun={onRun} onCancel={vi.fn()} />);
    // Selection starts at index 0 (New chat); ArrowDown moves to Change appearance.
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0]?.[0]?.id).toBe("theme");
  });

  it("runs an action on click", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn<(a: AppAction) => void>();
    render(<ActionPalette actions={ACTIONS} onRun={onRun} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /New chat/ }));
    expect(onRun.mock.calls[0]?.[0]?.id).toBe("new");
  });

  it("never runs a disabled action", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn<(a: AppAction) => void>();
    render(<ActionPalette actions={ACTIONS} onRun={onRun} onCancel={vi.fn()} />);
    const disabled = screen.getByRole("button", { name: /Delete workspace/ });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn<() => void>();
    render(<ActionPalette actions={ACTIONS} onRun={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
