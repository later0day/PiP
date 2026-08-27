import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FileContentResponse, FileTreeEntry } from "@shared/pluginApiTypes";
import type { FileExplorerController } from "../../state/useFileExplorer";
import { WorkspaceFilesPanel } from "./WorkspaceFilesPanel";

// Ports the workspace Files panel to RTL. It's prop-driven via a FileExplorer
// controller, so no hook mocking is needed: the controller is passed directly.
// Covers the Files toolbar (Upload / Refresh / stale badge), the file-tree
// listing + empty state, the controller error alert, and the embedded file
// viewer (WorkspaceFileViewer) selection placeholder.
const entry = (over: Partial<FileTreeEntry> = {}): FileTreeEntry => ({
  name: "churn.ts",
  path: "src/churn.ts",
  type: "file",
  ...over,
});

const controller = (over: Partial<FileExplorerController> = {}): FileExplorerController => ({
  fileTree: [],
  expandedDirs: {},
  fileTreeStale: false,
  selectedFilePath: undefined,
  selectedFileContent: undefined,
  selectedFileLoadError: undefined,
  uploadBatches: [],
  error: undefined,
  refreshFiles: vi.fn(),
  expandDir: vi.fn(),
  selectFile: vi.fn(),
  startUpload: vi.fn(),
  cancelUpload: vi.fn(),
  clearUpload: vi.fn(),
  ...over,
});

const baseProps = {
  machineId: "local",
  projectId: "p1",
  workspaceId: "w1",
  uploadDefaultFolder: ".pi-web/attachments",
};

describe("WorkspaceFilesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the toolbar with Upload and Refresh", () => {
    render(<WorkspaceFilesPanel {...baseProps} explorer={controller()} />);
    expect(screen.getByRole("button", { name: "上传" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
  });

  it("shows the empty-tree message when no files are loaded", () => {
    render(<WorkspaceFilesPanel {...baseProps} explorer={controller()} />);
    expect(screen.getByText("未加载任何文件。")).toBeInTheDocument();
  });

  it("lists file-tree entries", () => {
    render(
      <WorkspaceFilesPanel
        {...baseProps}
        explorer={controller({ fileTree: [entry(), entry({ name: "menu.ts", path: "src/menu.ts" })] })}
      />,
    );
    expect(screen.getByText("churn.ts")).toBeInTheDocument();
    expect(screen.getByText("menu.ts")).toBeInTheDocument();
  });

  it("shows the stale badge and surfaces the controller error", () => {
    render(<WorkspaceFilesPanel {...baseProps} explorer={controller({ fileTreeStale: true, error: "tree fetch failed" })} />);
    expect(screen.getByText("已过时")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("tree fetch failed");
  });

  it("refreshes the tree when Refresh is clicked", () => {
    const refreshFiles = vi.fn();
    render(<WorkspaceFilesPanel {...baseProps} explorer={controller({ refreshFiles })} />);
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(refreshFiles).toHaveBeenCalledTimes(1);
  });

  it("renders the embedded file viewer selection prompt", () => {
    render(<WorkspaceFilesPanel {...baseProps} explorer={controller()} />);
    expect(screen.getByText("请选择一个文件。")).toBeInTheDocument();
  });

  it("renders a loaded file's content in the viewer", () => {
    const file: FileContentResponse = {
      path: "src/churn.ts",
      language: "typescript",
      encoding: "utf8",
      size: 20,
      modifiedAt: "2026-01-01T00:00:00Z",
      content: "export const c = 1",
      truncated: false,
      binary: false,
    };
    render(
      <WorkspaceFilesPanel
        {...baseProps}
        explorer={controller({ selectedFilePath: "src/churn.ts", selectedFileContent: file })}
      />,
    );
    // The viewer header shows the selected path.
    expect(screen.getAllByText("src/churn.ts").length).toBeGreaterThan(0);
  });
});
