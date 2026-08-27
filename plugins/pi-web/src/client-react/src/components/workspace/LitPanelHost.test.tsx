import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { html } from "lit-html";
import { LitPanelHost } from "./LitPanelHost";

// Ports the Lit interop bridge to RTL. The host mounts a lit-html TemplateResult
// into a plain DOM node via lit-html's own render(), re-renders when the template
// changes, and clears the lit subtree on unmount so directives detach.
describe("LitPanelHost", () => {
  it("renders the lit template into its host node", () => {
    const { container } = render(<LitPanelHost template={html`<p class="lit-body">Churn plan</p>`} />);
    const body = container.querySelector(".lit-body");
    expect(body).not.toBeNull();
    expect(body?.textContent).toBe("Churn plan");
  });

  it("re-renders when the template changes", () => {
    const { container, rerender } = render(<LitPanelHost template={html`<span>first</span>`} />);
    expect(container.textContent).toContain("first");
    rerender(<LitPanelHost template={html`<span>second</span>`} />);
    expect(container.textContent).toContain("second");
    expect(container.textContent).not.toContain("first");
  });

  it("clears the lit subtree on unmount", () => {
    const { container, unmount } = render(<LitPanelHost template={html`<b class="lit-mark">x</b>`} />);
    expect(container.querySelector(".lit-mark")).not.toBeNull();
    unmount();
    expect(container.querySelector(".lit-mark")).toBeNull();
  });
});
