import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionTreeView } from "./SessionTreeView";
import type { SessionTreeSnapshot } from "@shared/apiTypes";

// Ports SessionTreeView (beautifului #16 read-only half) to RTL. Renders the
// SessionTreeSnapshot as a roving-tabindex treeitem list with kind badges and
// Active path / Active leaf markers, a disclosure toggle per parent, and Escape
// to close. Reuses the pure sessionTreeModel for build/visible/fold logic.
const snapshot: SessionTreeSnapshot = {
  nodes: [
    { id: "root", parentId: null, kind: "user", summary: "Kick off the churn plan" },
    { id: "a", parentId: "root", kind: "assistant", summary: "Drafting the schedule" },
    { id: "b", parentId: "a", kind: "tool-result", summary: "Ran the freezer check" },
  ],
  activeLeafId: "b",
  activePathIds: ["root", "a", "b"],
};

describe("SessionTreeView", () => {
  it("renders the tree with each node's summary and kind label", () => {
    render(<SessionTreeView snapshot={snapshot} onClose={vi.fn()} />);
    expect(screen.getByRole("tree", { name: "完整会话历史" })).toBeInTheDocument();
    expect(screen.getByText("Kick off the churn plan")).toBeInTheDocument();
    expect(screen.getByText("Drafting the schedule")).toBeInTheDocument();
    expect(screen.getByText("用户")).toBeInTheDocument();
    expect(screen.getByText("助手")).toBeInTheDocument();
  });

  it("marks the active leaf row with aria-current", () => {
    render(<SessionTreeView snapshot={snapshot} onClose={vi.fn()} />);
    const leafRow = screen.getByText("Ran the freezer check").closest("[role='treeitem']");
    expect(leafRow).not.toBeNull();
    if (leafRow === null) return;
    expect(leafRow).toHaveAttribute("aria-current", "true");
  });

  it("shows the empty-state message when there are no nodes", () => {
    render(
      <SessionTreeView
        snapshot={{ nodes: [], activeLeafId: null, activePathIds: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText("此会话不包含任何可选的历史条目。"),
    ).toBeInTheDocument();
  });

  it("closes via the close button", () => {
    const onClose = vi.fn<() => void>();
    render(<SessionTreeView snapshot={snapshot} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
