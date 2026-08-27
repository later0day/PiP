import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SessionStatus } from "@shared/apiTypes";
import { StatusBar } from "./StatusBar";

const status = (over: Partial<SessionStatus> = {}): SessionStatus => ({
  sessionId: "s1",
  isStreaming: false,
  isCompacting: false,
  isBashRunning: false,
  pendingMessageCount: 0,
  queuedMessages: [],
  tokens: { input: 1200, output: 340, cacheRead: 0, cacheWrite: 0, total: 1540 },
  cost: 0.42,
  ...over,
});

// Ports StatusBar.ts to RTL: the token/cost/context metrics row from a live
// SessionStatus, plus the queued/compacting/streaming conditional segments and
// the empty placeholder.
describe("StatusBar", () => {
  it("shows a placeholder when there is no status yet", () => {
    render(<StatusBar status={undefined} />);
    expect(screen.getByText("暂无会话状态")).toBeInTheDocument();
  });

  it("renders input/output tokens and cost", () => {
    render(<StatusBar status={status()} />);
    expect(screen.getByText("↑1.2k")).toBeInTheDocument();
    expect(screen.getByText("↓340")).toBeInTheDocument();
    expect(screen.getByText("$0.42")).toBeInTheDocument();
  });

  it("renders a percent/window context reading when usage is known", () => {
    render(<StatusBar status={status({ contextUsage: { tokens: 5000, contextWindow: 200_000, percent: 2.5 } })} />);
    expect(screen.getByText("2.5%/200k")).toBeInTheDocument();
  });

  it("falls back to an unknown-context label when there is no usage", () => {
    render(<StatusBar status={status()} />);
    expect(screen.getByText("上下文未知")).toBeInTheDocument();
  });

  it("shows the queued count only when messages are pending", () => {
    const { rerender } = render(<StatusBar status={status()} />);
    expect(screen.queryByText(/排队/)).not.toBeInTheDocument();
    rerender(<StatusBar status={status({ pendingMessageCount: 2 })} />);
    expect(screen.getByText("2 条排队")).toBeInTheDocument();
  });

  it("shows compacting over streaming when both are active", () => {
    render(<StatusBar status={status({ isStreaming: true, isCompacting: true })} />);
    expect(screen.getByText("压缩中…")).toBeInTheDocument();
    expect(screen.queryByText("输出中…")).not.toBeInTheDocument();
  });

  it("shows streaming when only streaming is active", () => {
    render(<StatusBar status={status({ isStreaming: true })} />);
    expect(screen.getByText("输出中…")).toBeInTheDocument();
  });
});
