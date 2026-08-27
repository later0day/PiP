import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Markdown } from "./Markdown";

// Ports the chat markdown seam to RTL. Prose flows through toSafeMarkdownHtml
// (marked + sanitizer) injected as HTML; top-level fenced code blocks render as
// MarkdownCodeBlock cards (lang banner + copy + line numbers).
describe("Markdown", () => {
  it("renders inline prose as formatted HTML", () => {
    render(<Markdown text="Churn **pistachio** first" />);
    expect(screen.getByText("pistachio").tagName.toLowerCase()).toBe("strong");
  });

  it("renders a fenced code block as a code card with a lang banner", () => {
    render(<Markdown text={"```ts\nconst x = 1\n```"} />);
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(screen.getByText("const")).toBeInTheDocument();
  });

  it("labels an unlabeled fence as code", () => {
    render(<Markdown text={"```\nplain\n```"} />);
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("copies the fenced code to the clipboard", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<Markdown text={"```ts\nconst x = 1\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => { expect(screen.getByText("已复制")).toBeInTheDocument(); });
    expect(writeText.mock.calls[0]?.[0]).toContain("const x = 1");
  });
});
