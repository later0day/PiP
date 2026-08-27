import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsightCards } from "./InsightCards";

// Ports InsightCards (beautifului #17) to RTL: the 3-page insight pager
// (compare / anomaly / allocation), prev/next navigation, and the per-page
// interactions (anomaly Spend/Usage toggle, allocation segment selection).
describe("InsightCards", () => {
  it("renders the compare page and pager header by default", () => {
    render(<InsightCards />);
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Mint Chip")).toBeInTheDocument();
    expect(screen.getByText("Pistachio")).toBeInTheDocument();
  });

  it("advances to the anomaly page with the next button", async () => {
    const user = userEvent.setup();
    render(<InsightCards />);
    await user.click(screen.getByRole("button", { name: "Next insight" }));
    expect(screen.getByText("High freezer spend")).toBeInTheDocument();
  });

  it("wraps backward from compare to the allocation page", async () => {
    const user = userEvent.setup();
    render(<InsightCards />);
    await user.click(screen.getByRole("button", { name: "Previous insight" }));
    expect(screen.getByText("Vanilla allocation")).toBeInTheDocument();
  });

  it("toggles Spend/Usage metrics on the anomaly page", async () => {
    const user = userEvent.setup();
    render(<InsightCards initialPage={1} />);
    const usage = screen.getByRole("button", { name: "Usage" });
    await user.click(usage);
    expect(usage).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("82 kWh threshold")).toBeInTheDocument();
  });

  it("selects an allocation segment", async () => {
    const user = userEvent.setup();
    render(<InsightCards initialPage={2} />);
    const chocChip = screen.getByRole("button", { name: /CHOC/ });
    await user.click(chocChip);
    expect(chocChip).toHaveAttribute("aria-pressed", "true");
  });
});
