import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThinkingState } from "./ThinkingState";

// Ports ThinkingState (beautifului #2) to RTL. The trace is timeline-driven via
// useSequence (chained setTimeout across renders), which React 18 does not flush
// cleanly under fake timers, so we run real timers and await the settled state
// with findBy* queries. We assert the active→done header flip, the settle
// callback, the expandable trace rows per variant, and the Coding variant's
// selectable tool rows. STAGES sum to ~7.4s, so we allow a 9s timeout.
const SETTLE = { timeout: 9000 } as const;

describe("ThinkingState", () => {
  it("shows the working label then settles to the done label", async () => {
    render(<ThinkingState />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(await screen.findByText("Thought for 4 seconds", {}, SETTLE)).toBeInTheDocument();
  }, 12000);

  it("fires onSettled exactly once when the trace finishes", async () => {
    const onSettled = vi.fn<() => void>();
    render(<ThinkingState onSettled={onSettled} />);
    expect(onSettled).not.toHaveBeenCalled();
    await screen.findByText("Thought for 4 seconds", {}, SETTLE);
    expect(onSettled).toHaveBeenCalledTimes(1);
  }, 12000);

  it("reveals the trace rows for the Steps variant", async () => {
    render(<ThinkingState variant="Steps" />);
    await screen.findByText("Thought for 4 seconds", {}, SETTLE);
    expect(screen.getByText("Reading flavor briefs")).toBeInTheDocument();
    expect(screen.getByText("Writing the scoop report")).toBeInTheDocument();
  }, 12000);

  it("renders search result links with the query for the Search variant", async () => {
    render(<ThinkingState variant="Search" />);
    // Wait for the settled state, when every result row is rendered.
    await screen.findByText("Searched the web", {}, SETTLE);
    expect(screen.getByText("best waffle cone supplier")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Joy Cone/ }, SETTLE)).toHaveAttribute(
      "href",
      "https://joycone.com/fs_products/waffle-cones/",
    );
  }, 12000);

  it("toggles a selectable tool row for the Coding variant", async () => {
    render(<ThinkingState variant="Coding" />);
    await screen.findByText("Ran 3 tools", {}, SETTLE);
    const readRow = screen.getByRole("button", { name: /Read/ });
    expect(readRow).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(readRow);
    expect(readRow).toHaveAttribute("aria-pressed", "true");
  }, 12000);

  it("collapses and expands the trace via the header", async () => {
    render(<ThinkingState />);
    const header = await screen.findByRole("button", { name: /Thought for 4 seconds/ }, SETTLE);
    // The trace auto-collapses at the final stage; wait for that stable state
    // so the manual toggle isn't racing the auto-expand transition.
    await waitFor(() => { expect(header).toHaveAttribute("aria-expanded", "false"); }, SETTLE);
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
  }, 12000);
});
