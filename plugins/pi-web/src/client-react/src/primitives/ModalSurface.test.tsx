import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModalSurface } from "./ModalSurface";

// Ports the ModalSurface.test.ts behavior contract to RTL: portal render, the
// dialog role + aria wiring, Escape/backdrop close (suppressed while busy),
// focus-into-dialog on open, and focus restore on unmount.
describe("ModalSurface", () => {
  it("renders a labelled modal dialog in a portal on document.body", () => {
    render(
      <ModalSurface onClose={vi.fn()} label="Pick a model">
        <button type="button">Inside</button>
      </ModalSurface>,
    );
    const dialog = screen.getByRole("dialog", { name: "Pick a model" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalSurface onClose={onClose}>
        <button type="button">Inside</button>
      </ModalSurface>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape while busy", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalSurface onClose={onClose} busy>
        <button type="button">Inside</button>
      </ModalSurface>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the backdrop itself is pressed but not the surface", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalSurface onClose={onClose} label="Sheet">
        <button type="button">Inside</button>
      </ModalSurface>,
    );
    // Pressing a child inside the surface must not close.
    await user.click(screen.getByRole("button", { name: "Inside" }));
    expect(onClose).not.toHaveBeenCalled();
    // Pressing the backdrop (the dialog's parent) closes.
    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).not.toBeNull();
    if (backdrop !== null) await user.pointer({ keys: "[MouseLeft]", target: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog on open and restores it on unmount", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <ModalSurface onClose={vi.fn()} label="Sheet">
        <button type="button">Inside</button>
      </ModalSurface>,
    );
    // Focus is now inside the dialog (the section itself, tabIndex -1).
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("honors initialFocus selector", () => {
    render(
      <ModalSurface onClose={vi.fn()} initialFocus="[data-autofocus]" label="Sheet">
        <button type="button">First</button>
        <input data-autofocus aria-label="Search" />
      </ModalSurface>,
    );
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search" }));
  });
});
