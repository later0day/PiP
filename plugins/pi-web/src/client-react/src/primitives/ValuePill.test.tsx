import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValuePill } from "./ValuePill";

// ValuePill primitive: a small value pill with an optional green/red tone.
describe("ValuePill", () => {
  it("renders its children", () => {
    render(<ValuePill>7 days</ValuePill>);
    expect(screen.getByText("7 days")).toBeInTheDocument();
  });

  it("applies a tone class when a tone is given", () => {
    const { rerender } = render(<ValuePill tone="green">up</ValuePill>);
    const green = screen.getByText("up");
    expect(green.className).not.toBe("");
    rerender(<ValuePill tone="red">down</ValuePill>);
    expect(screen.getByText("down")).toBeInTheDocument();
  });
});
