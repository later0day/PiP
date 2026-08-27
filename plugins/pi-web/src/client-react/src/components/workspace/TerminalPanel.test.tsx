import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TerminalInfo } from "@shared/apiTypes";
import type { TerminalCommandRun } from "@shared/pluginApiTypes";
import type { TerminalsController, TerminalSize } from "../../state/useTerminals";

// Ports the interactive TerminalPanel to RTL. It renders the tab strip
// (create / select / close), the loading / error / empty states, and the
// command-run notice (cancel while running, continue-in-shell after exit). The
// xterm view + socket lifecycle owns raw DOM/network internals, so @xterm/xterm,
// @xterm/addon-fit and the terminalSocket seam are stubbed inert; useTerminals is
// overridden with a controller fixture while the pure helpers stay real.
let currentController: TerminalsController;

const controller = (over: Partial<TerminalsController> = {}): TerminalsController => ({
  terminals: [],
  commandRuns: [],
  loading: false,
  error: undefined,
  cancellingRunIds: [],
  continuingTerminalIds: [],
  refresh: vi.fn(),
  startTerminal: vi.fn<(size?: TerminalSize) => Promise<TerminalInfo | undefined>>().mockResolvedValue(undefined),
  closeTerminal: vi.fn<(terminalId: string) => Promise<void>>().mockResolvedValue(undefined),
  continueTerminal: vi.fn<(terminalId: string) => Promise<TerminalInfo | undefined>>().mockResolvedValue(undefined),
  cancelCommandRun: vi.fn<(run: TerminalCommandRun) => Promise<void>>().mockResolvedValue(undefined),
  markExited: vi.fn(),
  ...over,
});

vi.mock("../../state/useTerminals", async (importActual) => {
  const actual = await importActual<typeof import("../../state/useTerminals")>();
  return { ...actual, useTerminals: () => currentController };
});

vi.mock("@api/sockets", () => ({
  terminalSocket: () => ({
    binaryType: "arraybuffer",
    readyState: 0,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    proposeDimensions(): undefined {
      return undefined;
    }
    fit(): void {
      /* no-op */
    }
  },
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    options: Record<string, unknown> = {};
    loadAddon(): void {
      /* no-op */
    }
    open(): void {
      /* no-op */
    }
    onData(): void {
      /* no-op */
    }
    focus(): void {
      /* no-op */
    }
    write(): void {
      /* no-op */
    }
    writeln(): void {
      /* no-op */
    }
    dispose(): void {
      /* no-op */
    }
  },
}));

const { TerminalPanel } = await import("./TerminalPanel");

const terminal = (over: Partial<TerminalInfo> = {}): TerminalInfo => ({
  id: "t1",
  cwd: "/root/orchard",
  name: "shell",
  createdAt: "2026-01-01T00:00:00Z",
  exited: false,
  ...over,
});

const commandRun = (over: Partial<TerminalCommandRun> = {}): TerminalCommandRun => ({
  id: "r1",
  origin: "agent",
  projectId: "p1",
  workspaceId: "w1",
  terminalId: "t1",
  title: "Churn build",
  command: "npm run churn",
  status: "running",
  createdAt: "2026-01-01T00:00:00Z",
  metadata: {},
  ...over,
});

const baseProps = {
  machineId: "local",
  projectId: "p1",
  workspaceId: "w1",
  selectedTerminalId: undefined,
  onSelectTerminal: vi.fn(),
};

describe("TerminalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentController = controller();
  });

  it("shows the empty state when there are no terminals", () => {
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    expect(screen.getByText("暂无终端。启动一个 Shell 以开始。")).toBeInTheDocument();
  });

  it("shows the loading state while terminals load", () => {
    currentController = controller({ loading: true });
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    expect(screen.getByText("正在加载终端…")).toBeInTheDocument();
  });

  it("surfaces the controller error", () => {
    currentController = controller({ error: "terminals unavailable" });
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    expect(screen.getByText("terminals unavailable")).toBeInTheDocument();
  });

  it("lists terminal tabs and marks exited ones", () => {
    currentController = controller({ terminals: [terminal(), terminal({ id: "t2", name: "logs", exited: true })] });
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    expect(screen.getByText("shell")).toBeInTheDocument();
    expect(screen.getByText(/logs/)).toBeInTheDocument();
    expect(screen.getByText(/· 已退出/)).toBeInTheDocument();
  });

  it("starts a new shell when the + Shell button is clicked", () => {
    const startTerminal = vi.fn<(size?: TerminalSize) => Promise<TerminalInfo | undefined>>().mockResolvedValue(undefined);
    currentController = controller({ startTerminal });
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Shell" }));
    expect(startTerminal).toHaveBeenCalledTimes(1);
  });

  it("closes a terminal via its close affordance", () => {
    const closeTerminal = vi.fn<(terminalId: string) => Promise<void>>().mockResolvedValue(undefined);
    currentController = controller({ terminals: [terminal()], closeTerminal });
    render(<TerminalPanel {...baseProps} onSelectTerminal={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭 shell" }));
    expect(closeTerminal).toHaveBeenCalledWith("t1");
  });

  it("shows a running command notice with a cancel button", () => {
    currentController = controller({
      terminals: [terminal({ commandRunId: "r1" })],
      commandRuns: [commandRun()],
    });
    render(<TerminalPanel {...baseProps} selectedTerminalId="t1" onSelectTerminal={vi.fn()} />);
    expect(screen.getByText("Churn build")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消命令" })).toBeInTheDocument();
  });

  it("offers continue-in-shell after an exited command run", () => {
    currentController = controller({
      terminals: [terminal({ exited: true, commandRunId: "r1" })],
      commandRuns: [commandRun({ status: "succeeded", completedAt: "2026-01-01T00:01:00Z" })],
    });
    render(<TerminalPanel {...baseProps} selectedTerminalId="t1" onSelectTerminal={vi.fn()} />);
    expect(screen.getByRole("button", { name: "在 Shell 中继续" })).toBeInTheDocument();
  });
});
