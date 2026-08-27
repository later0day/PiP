import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DiffTable } from "./DiffTable";

// Ports DiffTable (beautifului #11) to RTL. The 3-stage reveal runs via useStage
// (~440ms), so we run real timers and await the settled state (the "Click
// changed rows to toggle" hint). We assert the diff rows, the row-level toggle
// (aria-selected), the added-row checkbox, the summary count, and Apply → the
// applied confirmation pill.
const SETTLE = { timeout: 4000 } as const;

describe("DiffTable", () => {
  it("renders the proposed cleanup rows and settles into an interactive diff", async () => {
    render(<DiffTable />);
    expect(screen.getByText("Proposed menu cleanup")).toBeInTheDocument();
    expect(screen.getByText("Rocky Road")).toBeInTheDocument();
    expect(await screen.findByText("Click changed rows to toggle", {}, SETTLE)).toBeInTheDocument();
  });

  it("toggles a removed row off and on", async () => {
    render(<DiffTable />);
    await screen.findByText("Click changed rows to toggle", {}, SETTLE);
    const row = screen.getByText("Rocky Road").closest("tr");
    expect(row).not.toBeNull();
    if (row === null) return;
    expect(row).toHaveAttribute("aria-selected", "true");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-selected", "false");
  });

  it("toggles the added Pistachio row via its checkbox", async () => {
    render(<DiffTable />);
    await screen.findByText("Click changed rows to toggle", {}, SETTLE);
    const added = screen.getByRole("checkbox", { name: "Include adding Pistachio" });
    expect(added).toHaveAttribute("aria-checked", "true");
    fireEvent.click(added);
    expect(added).toHaveAttribute("aria-checked", "false");
  });

  it("summarizes the pending edits and applies them", async () => {
    render(<DiffTable />);
    await screen.findByText("Click changed rows to toggle", {}, SETTLE);
    // Default draft: rocky + bubblegum removals, pistachio addition = 2 removals · 1 addition.
    expect(screen.getByText("2 removals · 1 addition")).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: /Apply 3 changes/ });
    fireEvent.click(apply);
    expect(screen.getByText(/3 edits applied/)).toBeInTheDocument();
  });

  it("disables Apply once every change is toggled off", async () => {
    render(<DiffTable />);
    await screen.findByText("Click changed rows to toggle", {}, SETTLE);
    fireEvent.click(screen.getByRole("checkbox", { name: "Include adding Pistachio" }));
    const rocky = screen.getByText("Rocky Road").closest("tr");
    const bubblegum = screen.getByText("Bubblegum").closest("tr");
    if (rocky === null || bubblegum === null) return;
    fireEvent.click(rocky);
    fireEvent.click(bubblegum);
    const footer = screen.getByText(/removals ·/).closest("div");
    expect(footer).not.toBeNull();
    if (footer === null) return;
    expect(within(footer).getByRole("button", { name: /Apply/ })).toBeDisabled();
  });
});
