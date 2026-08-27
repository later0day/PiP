import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatView } from "./ChatView";
import type { ChatLine } from "@client/components/shared";

// Ports the chat transcript to RTL. ChatLine[] → groupChatMessages → per-turn
// rendering: user turns are right-aligned bubbles, assistant turns borderless
// markdown (both label-less, per the mockup); tool events group into a
// collapsible <details>. Covers turn text, the error banner, the empty-loading
// placeholder, and preformatted shell output.
const line = (role: ChatLine["role"], text: string): ChatLine => ({
  role,
  parts: [{ type: "text", text }],
});

describe("ChatView", () => {
  it("renders user and assistant turn text", () => {
    render(
      <ChatView
        messages={[line("user", "Churn pistachio"), line("assistant", "On it")]}
        loading={false}
        error={undefined}
      />,
    );
    expect(screen.getByText("Churn pistachio")).toBeInTheDocument();
    expect(screen.getByText("On it")).toBeInTheDocument();
  });

  it("shows the error banner when an error is present", () => {
    render(<ChatView messages={[]} loading={false} error="stream failed" />);
    expect(screen.getByText("stream failed")).toBeInTheDocument();
  });

  it("shows the loading placeholder only when there are no messages", () => {
    const { rerender } = render(<ChatView messages={[]} loading error={undefined} />);
    expect(screen.getByText("正在加载会话记录…")).toBeInTheDocument();
    rerender(<ChatView messages={[line("user", "hi")]} loading error={undefined} />);
    expect(screen.queryByText("正在加载会话记录…")).not.toBeInTheDocument();
  });

  it("renders a shell message as preformatted output", () => {
    render(<ChatView messages={[line("bash", "$ npm run freeze")]} loading={false} error={undefined} />);
    const pre = screen.getByText("$ npm run freeze");
    expect(pre.tagName.toLowerCase()).toBe("pre");
  });
});
