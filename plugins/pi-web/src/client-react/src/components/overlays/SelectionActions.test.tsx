import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelectionActions } from "./SelectionActions";

// Ports SelectionActions (beautifului #20) to RTL. A floating action bar over a
// text selection: idle presets (Explain/Improve/…), a "more" chevron that
// expands the extra actions, a describe-edits prompt, and running an action that
// flips to a busy "…ing" label then streams to a Keep/Discard result. The
// shown/thinking timers are short; the content is always mounted (only opacity
// gates), so the preset buttons are queryable immediately.
const SETTLE = { timeout: 3000 } as const;

describe("SelectionActions", () => {
  it("renders the idle preset actions", () => {
    render(<SelectionActions />);
    expect(screen.getByRole("button", { name: /Explain/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Improve/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more actions" })).toBeInTheDocument();
  });

  it("expands the extra actions via the more chevron", () => {
    render(<SelectionActions />);
    const more = screen.getByRole("button", { name: "Show more actions" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Shorten/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grammar/ })).toBeInTheDocument();
  });

  it("runs an action and shows the busy label", () => {
    render(<SelectionActions />);
    fireEvent.click(screen.getByRole("button", { name: /Improve/ }));
    expect(screen.getByText("Improving…")).toBeInTheDocument();
  });

  it("streams to a Keep/Discard result after running", async () => {
    render(<SelectionActions />);
    fireEvent.click(screen.getByRole("button", { name: /Improve/ }));
    await screen.findByRole("button", { name: /Keep/ }, SETTLE);
    expect(screen.getByRole("button", { name: /Discard/ })).toBeInTheDocument();
  }, 6000);

  it("returns to idle after keeping the result", async () => {
    render(<SelectionActions />);
    fireEvent.click(screen.getByRole("button", { name: /Improve/ }));
    const keep = await screen.findByRole("button", { name: /Keep/ }, SETTLE);
    fireEvent.click(keep);
    await waitFor(
      () => { expect(screen.getByRole("button", { name: /Improve/ })).toBeInTheDocument(); },
      SETTLE,
    );
  }, 6000);
});
