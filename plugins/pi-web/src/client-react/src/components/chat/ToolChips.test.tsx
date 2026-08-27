import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToolChips } from "./ToolChips";

// Ports ToolChips (beautifului #5) to RTL. The run header collapses the rows;
// tool-call rows stream in via a chained setTimeout (STEP_MS), each expandable to
// its detail steps; after all rows the file-diff chips appear. Chained-setTimeout
// scheduling doesn't flush under fake timers in React 18, so use REAL timers +
// findBy/waitFor with a widened timeout, and fireEvent after settle.
const SETTLE = { timeout: 6000 } as const;

describe("ToolChips", () => {
  it("streams the tool-call rows and the run header count", async () => {
    render(<ToolChips />);
    expect(screen.getByText("4 tool calls, 2 messages")).toBeInTheDocument();
    await screen.findByText("Thinking", {}, SETTLE);
    await screen.findByText("Write 204 lines", {}, SETTLE);
    await screen.findByText("Rebuild and verify", {}, SETTLE);
    await screen.findByText("Read image", {}, SETTLE);
  }, 9000);

  it("collapses the run when the header is toggled", () => {
    render(<ToolChips />);
    const header = screen.getByRole("button", { name: /4 tool calls/ });
    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("expands a tool-call row to reveal its detail steps", async () => {
    render(<ToolChips />);
    const row = await screen.findByRole("button", { name: /Thinking/ }, SETTLE);
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Weekend demand carries pistachio, so it churns first."),
    ).toBeInTheDocument();
  }, 9000);

  it("shows the file-diff chips once every row has streamed in", async () => {
    render(<ToolChips />);
    await waitFor(
      () => { expect(screen.getByRole("button", { name: "Show diff for menu.ts" })).toBeInTheDocument(); },
      SETTLE,
    );
    expect(screen.getByRole("button", { name: "Show diff for ChurnSchedule.tsx" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();
  }, 9000);

  it("opens a body-portaled diff preview when a chip is focused", async () => {
    render(<ToolChips />);
    const chip = await screen.findByRole(
      "button",
      { name: "Show diff for menu.ts" },
      SETTLE,
    );
    fireEvent.focus(chip);
    await waitFor(() => { expect(chip).toHaveAttribute("aria-expanded", "true"); }, SETTLE);
    // The diff body lines are portaled to document.body.
    expect(screen.getByText('export const hero = "pistachio";')).toBeInTheDocument();
  }, 9000);
});
