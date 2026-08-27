import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlideMenu } from "./GlideMenu";

// GlideMenu primitive: renders its children plus an aria-hidden highlight block
// that follows the hovered [data-glide-item]. happy-dom returns zeroed rects, so
// we assert structure/opacity transitions rather than pixel positions.
describe("GlideMenu", () => {
  it("renders its items and a hidden highlight", () => {
    render(
      <GlideMenu>
        <button data-glide-item type="button">One</button>
        <button data-glide-item type="button">Two</button>
      </GlideMenu>,
    );
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
  });

  it("reveals the highlight on item hover and hides it on leave", () => {
    const { container } = render(
      <GlideMenu>
        <button data-glide-item type="button">One</button>
      </GlideMenu>,
    );
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    if (root === null) return;
    const highlight = root.querySelector("[aria-hidden]");
    expect(highlight).not.toBeNull();
    if (highlight === null) return;
    fireEvent.mouseMove(screen.getByRole("button", { name: "One" }));
    expect(highlight.getAttribute("style")).toContain("opacity: 1");
    fireEvent.mouseLeave(root);
    expect(highlight.getAttribute("style")).toContain("opacity: 0");
  });
});
