import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { StreamText } from "./StreamText";

// StreamText primitive: a typewriter revealing text one char at a time at
// 18ms/char, calling onProgress each tick and onDone when finished. Driven with
// fake timers.
describe("StreamText", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("reveals the text character by character and fires onDone", () => {
    const onDone = vi.fn<() => void>();
    const onProgress = vi.fn<() => void>();
    const { container } = render(<StreamText text="hi" onProgress={onProgress} onDone={onDone} />);
    expect(container.textContent).toBe("");
    act(() => { vi.advanceTimersByTime(18); });
    expect(container.textContent).toBe("h");
    act(() => { vi.advanceTimersByTime(18); });
    expect(container.textContent).toBe("hi");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it("renders nothing and never completes for empty text", () => {
    const onDone = vi.fn<() => void>();
    const { container } = render(<StreamText text="" onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(container.textContent).toBe("");
    expect(onDone).not.toHaveBeenCalled();
  });
});
