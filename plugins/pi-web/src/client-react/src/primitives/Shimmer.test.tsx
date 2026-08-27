import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shimmer } from "./Shimmer";

// Shimmer primitive: a gradient text-mask wrapper. Behavior is CSS-only; we
// verify it renders its children and accepts an extra className.
describe("Shimmer", () => {
  it("renders its children", () => {
    render(<Shimmer>Thinking…</Shimmer>);
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("merges an extra className onto the shimmer span", () => {
    render(<Shimmer className="extra">Loading</Shimmer>);
    expect(screen.getByText("Loading").className).toContain("extra");
  });
});
