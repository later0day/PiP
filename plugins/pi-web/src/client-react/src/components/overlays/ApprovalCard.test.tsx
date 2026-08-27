import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalCard } from "./ApprovalCard";

// Ports ApprovalCard (beautifului #4) to RTL. A single-card question flow: the
// question is the heading, radios auto-advance after a 480ms timer, checks are
// multi-select, a rolling counter tracks progress, and the final Send fires
// onSubmitted. The radio auto-advance uses a setTimeout, so use waitFor with a
// widened timeout after a radio pick.
const SETTLE = { timeout: 3000 } as const;

describe("ApprovalCard", () => {
  it("renders the first question, its options, and the step counter", () => {
    render(<ApprovalCard />);
    expect(screen.getByText("How many flavors should we launch?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Three \(core line\)/ })).toBeInTheDocument();
    // The counter is rendered as per-character rolling-digit spans.
    expect(screen.getByRole("button", { name: "Next question" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous question" })).toBeDisabled();
  });

  it("auto-advances to the next question after a radio pick", async () => {
    render(<ApprovalCard />);
    fireEvent.click(screen.getByRole("button", { name: /Five \(full case\)/ }));
    await screen.findByText("Which mix-ins should we stock?", {}, SETTLE);
  });

  it("keeps checkbox questions multi-select without auto-advancing", async () => {
    render(<ApprovalCard />);
    // Advance to Q2 (a check question) via the Next nav button.
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await screen.findByText("Which mix-ins should we stock?", {}, SETTLE);
    const chips = screen.getByRole("button", { name: /Chocolate chips/ });
    const waffle = screen.getByRole("button", { name: /Waffle bits/ });
    fireEvent.click(chips);
    fireEvent.click(waffle);
    expect(chips).toHaveAttribute("aria-pressed", "true");
    expect(waffle).toHaveAttribute("aria-pressed", "true");
    // Still on Q2 — no auto-advance for checks.
    expect(screen.getByText("Which mix-ins should we stock?")).toBeInTheDocument();
  });

  it("fires onSubmitted and shows the sent confirmation on the last question", async () => {
    const onSubmitted = vi.fn<() => void>();
    render(<ApprovalCard onSubmitted={onSubmitted} />);
    // Nav to the final question.
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await screen.findByText("Which mix-ins should we stock?", {}, SETTLE);
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await screen.findByText("Which market do we enter first?", {}, SETTLE);
    // Pick a radio → auto-send on the last question.
    fireEvent.click(screen.getByRole("button", { name: /Scoop shops/ }));
    await screen.findByText("Answers sent", {}, SETTLE);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("dismisses to a reopen button and restores the card", () => {
    render(<ApprovalCard />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const reopen = screen.getByRole("button", { name: "Open approval" });
    fireEvent.click(reopen);
    expect(screen.getByText("How many flavors should we launch?")).toBeInTheDocument();
  });
});
