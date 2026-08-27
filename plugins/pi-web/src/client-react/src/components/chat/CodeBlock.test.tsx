import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeBlock, highlight } from "./CodeBlock";

// Ports CodeBlock (beautifului #18) to RTL. Covers the pure `highlight`
// tokenizer, the Code variant (line numbers + copy button → clipboard) and the
// Diff variant (add/del gutter + +/- stat).
describe("highlight", () => {
  it("wraps keywords, strings, and function calls in colored spans", () => {
    const nodes = highlight('const flavor = getFlavor("pistachio")');
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThan(1);
  });

  it("returns a single node for plain text with no tokens", () => {
    const nodes = highlight("   ");
    expect(nodes).toHaveLength(1);
  });
});

describe("CodeBlock", () => {
  it("renders the Code variant with the filename and a copy button", () => {
    render(<CodeBlock />);
    expect(screen.getByText("churn.ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
  });

  it("copies the source and flips the button to Copied", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, so override it after.
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CodeBlock />);
    await user.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => { expect(screen.getByText("已复制")).toBeInTheDocument(); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain("export async function churnBatch()");
  });

  it("renders the Diff variant with an add/del stat instead of copy", () => {
    render(<CodeBlock variant="Diff" />);
    expect(screen.queryByRole("button", { name: "复制代码" })).not.toBeInTheDocument();
    const header = screen.getByText("churn.ts").closest("div");
    expect(header).not.toBeNull();
    if (header === null) return;
    // The DIFF fixture has 2 additions and 1 deletion.
    expect(within(header).getByText("+2")).toBeInTheDocument();
    expect(within(header).getByText("-1")).toBeInTheDocument();
  });
});
