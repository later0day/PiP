import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntityChip } from "./EntityChip";

// EntityChip primitive: an @mention pill with a colored initial avatar.
describe("EntityChip", () => {
  it("renders the name and its leading initial as the avatar", () => {
    render(<EntityChip name="Cone King" />);
    expect(screen.getByText("Cone King")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("falls back to a placeholder initial for an empty name", () => {
    render(<EntityChip name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
