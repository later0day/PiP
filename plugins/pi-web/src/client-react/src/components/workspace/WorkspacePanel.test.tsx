import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { initialAppState } from "@client/appState";
import type { Workspace } from "@shared/apiTypes";

// Ports the WorkspacePanel host to RTL. It renders the core Files + Terminal tab
// strip (plus any plugin panels), resolves the active tab from the route tool id,
// and shows the "Select a workspace" empty state when none is chosen. The state
// hooks hit apis/sockets and the two core panels own heavy CodeMirror/xterm
// internals, so all are stubbed; the tab-strip + active-panel wiring is real.
vi.mock("../../state/appStore", () => ({ useAppState: () => initialAppState() }));
vi.mock("../../state/useFileExplorer", () => ({ useFileExplorer: () => ({}) }));
vi.mock("../../state/useTerminals", () => ({ useTerminals: () => ({}) }));
vi.mock("../../state/usePlugins", () => ({ usePlugins: () => ({ workspacePanels: [] }) }));
vi.mock("../../state/useWorkspacePanelContext", () => ({ useWorkspacePanelContext: () => undefined }));
vi.mock("./WorkspaceFilesPanel", () => ({ WorkspaceFilesPanel: () => <div data-testid="files-panel" /> }));
vi.mock("./TerminalPanel", () => ({ TerminalPanel: () => <div data-testid="terminal-panel" /> }));

const { WorkspacePanel } = await import("./WorkspacePanel");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: "w1",
  projectId: "p1",
  path: "/root/orchard",
  label: "main",
  isMain: true,
  effectiveConfig: { uploads: {} },
  ...over,
});

describe("WorkspacePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the empty state when no workspace is selected", () => {
    render(<WorkspacePanel machineId="local" workspace={undefined} activeToolId={undefined} onSelectTool={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("选择工作区");
  });

  it("renders the Files and Terminal core tabs", () => {
    render(<WorkspacePanel machineId="local" workspace={workspace()} activeToolId="files" onSelectTool={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /文件/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /终端/ })).toBeInTheDocument();
  });

  it("defaults to the Files panel and marks its tab selected", () => {
    render(<WorkspacePanel machineId="local" workspace={workspace()} activeToolId={undefined} onSelectTool={vi.fn()} />);
    expect(screen.getByTestId("files-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /文件/ })).toHaveAttribute("aria-selected", "true");
  });

  it("renders the Terminal panel when the terminal tool is active", () => {
    render(<WorkspacePanel machineId="local" workspace={workspace()} activeToolId="terminal" onSelectTool={vi.fn()} />);
    expect(screen.getByTestId("terminal-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /终端/ })).toHaveAttribute("aria-selected", "true");
  });

  it("selects a tool when its tab is clicked", () => {
    const onSelectTool = vi.fn<(toolId: string) => void>();
    render(<WorkspacePanel machineId="local" workspace={workspace()} activeToolId="files" onSelectTool={onSelectTool} />);
    fireEvent.click(screen.getByRole("tab", { name: /终端/ }));
    expect(onSelectTool).toHaveBeenCalledWith("terminal");
  });
});
