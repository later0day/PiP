import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceFileViewer } from "./WorkspaceFileViewer";
import type { FileContentResponse } from "@shared/pluginApiTypes";

// Ports the workspace file viewer to RTL. Given a loaded FileContentResponse it
// picks a preview kind (image/html/pdf/markdown/download/code), shows the header
// path + metadata + Download action, offers a Raw/Preview toggle only for files
// that carry both, and renders status/error/loading placeholders otherwise.
const file = (over: Partial<FileContentResponse> = {}): FileContentResponse => ({
  path: "src/churn.ts",
  language: "typescript",
  encoding: "utf8",
  size: 128,
  modifiedAt: "2026-01-01T00:00:00Z",
  content: "export const churn = 1",
  truncated: false,
  binary: false,
  ...over,
});

const ids = { machineId: "m1", projectId: "p1", workspaceId: "w1" } as const;

describe("WorkspaceFileViewer", () => {
  it("prompts to select a file when nothing is selected", () => {
    render(
      <WorkspaceFileViewer {...ids} selectedPath={undefined} file={undefined} loadError={undefined} />,
    );
    expect(screen.getByText("请选择一个文件。")).toBeInTheDocument();
  });

  it("shows a loading placeholder while the file is fetching", () => {
    render(
      <WorkspaceFileViewer {...ids} selectedPath="src/churn.ts" file={undefined} loadError={undefined} />,
    );
    expect(screen.getByText("正在加载 src/churn.ts…")).toBeInTheDocument();
  });

  it("surfaces a load error as an alert", () => {
    render(
      <WorkspaceFileViewer {...ids} selectedPath="src/churn.ts" file={undefined} loadError="permission denied" />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("无法加载 src/churn.ts：permission denied");
  });

  it("renders a code file's header, metadata, and download action", () => {
    render(
      <WorkspaceFileViewer {...ids} selectedPath="src/churn.ts" file={file()} loadError={undefined} />,
    );
    expect(screen.getByText("src/churn.ts")).toBeInTheDocument();
    expect(screen.getByText(/typescript/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载" })).toBeInTheDocument();
    // Code kind has no Raw/Preview toggle.
    expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
  });

  it("offers a Raw/Preview toggle for a markdown file", () => {
    const md = file({ path: "README.md", language: "markdown", mediaType: "markdown", content: "# Title" });
    render(<WorkspaceFileViewer {...ids} selectedPath="README.md" file={md} loadError={undefined} />);
    expect(screen.getByRole("button", { name: "预览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "源码" })).toBeInTheDocument();
    // Default mode is raw.
    expect(screen.getByRole("button", { name: "源码" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports an empty file", () => {
    render(
      <WorkspaceFileViewer {...ids} selectedPath="empty.txt" file={file({ path: "empty.txt", size: 0, content: "" })} loadError={undefined} />,
    );
    expect(screen.getByText("此文件为空。")).toBeInTheDocument();
  });
});
