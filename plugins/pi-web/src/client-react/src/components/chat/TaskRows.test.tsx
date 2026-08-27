import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TaskRows } from "./TaskRows";

// Ports TaskRows (beautifului #6) to RTL. The status timeline is timer-driven
// via useTick, so we drive fake timers; the row labels are stable across ticks.
// We assert the three rows render, the manual expand toggles a row's detail
// steps, and the List variant still renders every row.
describe("TaskRows", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders the three task rows with their amounts", () => {
    render(<TaskRows />);
    expect(screen.getByText("Verified vendor records")).toBeInTheDocument();
    expect(screen.getByText("Build reorder task list")).toBeInTheDocument();
    expect(screen.getByText("Draft supplier emails")).toBeInTheDocument();
    expect(screen.getByText("12 suppliers")).toBeInTheDocument();
  });

  it("expands a row's detail steps on click", () => {
    render(<TaskRows />);
    const rowBtn = screen.getByRole("button", { name: /Verified vendor records/ });
    expect(rowBtn).toHaveAttribute("aria-expanded", "false");
    act(() => { rowBtn.click(); });
    expect(rowBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Matched tax and contact IDs")).toBeInTheDocument();
  });

  it("renders every row in the List variant", () => {
    render(<TaskRows variant="List" />);
    expect(screen.getByText("Verified vendor records")).toBeInTheDocument();
    expect(screen.getByText("Draft supplier emails")).toBeInTheDocument();
  });

  it("advances the scripted timeline through its ticks", () => {
    render(<TaskRows />);
    // Drive the whole tick schedule; the run resolves row 3 to Completed.
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });
});
