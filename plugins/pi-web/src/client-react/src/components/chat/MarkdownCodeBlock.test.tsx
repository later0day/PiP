import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

// Ports the chat fenced-code block to RTL. Wears the beautifului #18 CodeBlock
// shell (lang banner + line numbers + copy). Covers the lang label, per-line
// numbering, and copy → "Copied" via a clipboard mock.
describe("MarkdownCodeBlock", () => {
  it("renders the lang label and a number for each line", () => {
    render(<MarkdownCodeBlock lang="ts" code={"alpha\nbeta\ngamma"} />);
    expect(screen.getByText("ts")).toBeInTheDocument();
    // Line-number gutter has one entry per line.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("labels an empty lang as code", () => {
    render(<MarkdownCodeBlock lang="" code="noop" />);
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("copies the code and flips the button to Copied", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<MarkdownCodeBlock lang="ts" code="const x = 42" />);
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => { expect(screen.getByText("已复制")).toBeInTheDocument(); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toBe("const x = 42");
  });
});
