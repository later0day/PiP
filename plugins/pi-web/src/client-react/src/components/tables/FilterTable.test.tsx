import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterTable } from "./FilterTable";

// Ports FilterTable (beautifului #13) to RTL: the status filter chips (with
// counts) that filter the task rows via the animated collapse, the status pills,
// and the scrollable table region.
describe("FilterTable", () => {
  it("renders the filter chips with counts and every task row", () => {
    render(<FilterTable />);
    expect(screen.getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Restock mango sorbet")).toBeInTheDocument();
    expect(screen.getByText("Churn black sesame")).toBeInTheDocument();
    expect(screen.getByText("Order waffle cones")).toBeInTheDocument();
  });

  it("exposes the table as a scrollable region", () => {
    render(<FilterTable />);
    expect(screen.getByRole("region", { name: "Scrollable task table" })).toBeInTheDocument();
  });

  it("marks a chip active when its filter is chosen", async () => {
    const user = userEvent.setup();
    render(<FilterTable />);
    const done = screen.getByRole("button", { name: /Completed/ });
    await user.click(done);
    expect(done).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a status pill for each task", () => {
    render(<FilterTable />);
    // "To do" appears both as a filter chip and as row pills.
    expect(screen.getAllByText("To do").length).toBeGreaterThan(1);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });
});
