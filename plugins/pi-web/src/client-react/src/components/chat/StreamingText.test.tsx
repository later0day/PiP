import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StreamingText } from "./StreamingText";

// Ports StreamingText (beautifului #3) to RTL. The word stream advances via
// setTimeout; with loop=false it stops at the end and fires onDone. We run real
// timers and await the settled state (the follow-ups become usable), then assert
// the action row, the sources sheet toggle, and the follow-up prompts. The full
// stream is long (~40 words × 55ms), so we allow a generous timeout.
const SETTLE = { timeout: 6000 } as const;

describe("StreamingText", () => {
  it("streams to completion and fires onDone when not looping", async () => {
    const onDone = vi.fn<() => void>();
    render(<StreamingText loop={false} onDone={onDone} />);
    expect(await screen.findByText("后续问题", {}, SETTLE)).toBeInTheDocument();
    // onDone fires on the settle effect once the stream reaches the end.
    await waitFor(() => { expect(onDone).toHaveBeenCalled(); }, SETTLE);
  }, 9000);

  it("renders the source count and the action buttons once settled", async () => {
    render(<StreamingText loop={false} />);
    expect(await screen.findByText("10 个来源", {}, SETTLE)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "操作" }).length).toBeGreaterThan(0);
  }, 9000);

  it("toggles the sources sheet", async () => {
    render(<StreamingText loop={false} />);
    const sourcesBtn = await screen.findByRole("button", { name: /10 个来源/ }, SETTLE);
    expect(sourcesBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(sourcesBtn);
    expect(sourcesBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("冰淇淋数据")).toBeInTheDocument();
  }, 9000);
});
