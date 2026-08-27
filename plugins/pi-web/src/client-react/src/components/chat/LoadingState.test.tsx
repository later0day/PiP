import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LoadingState } from "./LoadingState";

// Ports LoadingState (beautifului #1) to RTL. The elapsed clock ticks via
// useElapsed, so we drive fake timers. We assert the default + custom labels,
// the live elapsed readout, the status role, and the Surfer video variant with
// its error fallback.
describe("LoadingState", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders the default churning label and a status region", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Churning")).toBeInTheDocument();
  });

  it("honors a custom label", () => {
    render(<LoadingState label="Compiling" />);
    expect(screen.getByText("Compiling")).toBeInTheDocument();
  });

  it("advances the live elapsed clock", () => {
    render(<LoadingState />);
    expect(screen.getByText("0.0s")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("1.0s")).toBeInTheDocument();
  });

  it("renders the Surfer variant with its video", () => {
    render(<LoadingState variant="Surfer" />);
    expect(screen.getByText("Subway surfing")).toBeInTheDocument();
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
  });

  it("falls back to a placeholder when the Surfer video errors", () => {
    render(<LoadingState variant="Surfer" />);
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    if (video === null) return;
    act(() => { video.dispatchEvent(new Event("error")); });
    expect(screen.getByText("Video unavailable")).toBeInTheDocument();
  });
});
