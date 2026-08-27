import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flowchart } from "./Flowchart";

// Ports Flowchart (beautifului #16) to RTL: the two step cards (Trigger +
// If/Else condition) joined by a bezier connector, the selectable trigger node,
// and the condition card's real dropdown chips (open/pick/aria-expanded).
describe("Flowchart", () => {
  it("renders the trigger and condition step cards", () => {
    render(<Flowchart />);
    expect(screen.getByText("Trigger")).toBeInTheDocument();
    expect(screen.getByText("New order created")).toBeInTheDocument();
    expect(screen.getByText("If / Else")).toBeInTheDocument();
  });

  it("toggles selection on the trigger node", async () => {
    const user = userEvent.setup();
    render(<Flowchart />);
    const trigger = screen.getByRole("button", { name: /New order created/ });
    expect(trigger).toHaveAttribute("aria-pressed", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a condition chip dropdown and picks a value", async () => {
    const user = userEvent.setup();
    render(<Flowchart />);
    // The first value chip shows the default flavor.
    const chip = screen.getByRole("button", { name: /Rocky Road/ });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    // Menu items appear; pick a different flavor.
    await user.click(screen.getByRole("button", { name: /Pistachio/ }));
    expect(screen.getByRole("button", { name: /Pistachio/ })).toBeInTheDocument();
  });

  it("renders the If/and condition keywords", () => {
    render(<Flowchart />);
    expect(screen.getByText("If")).toBeInTheDocument();
    expect(screen.getByText("and")).toBeInTheDocument();
  });
});
