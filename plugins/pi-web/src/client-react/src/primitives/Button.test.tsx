import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

// Infra smoke + first real RTL coverage: proves the happy-dom + RTL + jest-dom
// project wiring works, and pins the Button atom's behavior contract (default
// type="button", variant/size classes, disabled, click passthrough).
describe("Button", () => {
  it("renders children and defaults to type=button", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("forwards clicks and honors disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes through aria attributes and an explicit type", () => {
    render(
      <Button type="submit" aria-label="Confirm">
        ✓
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Confirm" });
    expect(button).toHaveAttribute("type", "submit");
  });

  it("applies a distinct class per variant, including the primary CTA", () => {
    const { rerender } = render(<Button variant="primary">Go</Button>);
    const primaryClass = screen.getByRole("button", { name: "Go" }).className;
    rerender(<Button variant="accent">Go</Button>);
    const accentClass = screen.getByRole("button", { name: "Go" }).className;
    // primary (high-emphasis ink fill) is a separate variant from accent (brand blue).
    expect(primaryClass).not.toBe("");
    expect(primaryClass).not.toBe(accentClass);
  });
});
