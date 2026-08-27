import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  SessionCleanupPreviewResponse,
  SessionCleanupRequest,
} from "@shared/apiTypes";
import { SessionCleanupDialog } from "./SessionCleanupDialog";

const preview: SessionCleanupPreviewResponse = {
  generatedAt: "2026-08-27T00:00:00Z",
  thresholds: { archiveIdleDays: 30 },
  projects: [
    { cwd: "/root/one", archiveCount: 3, deleteCount: 0 },
    { cwd: "/root/two", archiveCount: 2, deleteCount: 1 },
  ],
  totals: { archiveCount: 5, deleteCount: 1 },
};

// Matches the default draft (archive-idle enabled at 30 days) so canRunSessionCleanup
// finds a fresh preview keyed to the request.
const previewRequest: SessionCleanupRequest = { archiveIdleDays: 30, deleteArchivedDays: null };

function renderDialog(over: Partial<React.ComponentProps<typeof SessionCleanupDialog>> = {}): {
  onPreview: ReturnType<typeof vi.fn>;
  onRun: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
} {
  const onPreview = vi.fn();
  const onRun = vi.fn();
  const onClose = vi.fn();
  render(
    <SessionCleanupDialog
      preview={undefined}
      previewRequest={undefined}
      result={undefined}
      loading={false}
      running={false}
      error=""
      onPreview={onPreview}
      onRun={onRun}
      onClose={onClose}
      {...over}
    />,
  );
  return { onPreview, onRun, onClose };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// Ports SessionCleanupDialog.test.ts to RTL: threshold toggles gate their day
// inputs, Preview calls onPreview with the validated request, per-project
// selection updates the "N of M projects selected" count and totals, Run is
// disabled until a fresh preview with targets exists, and the run path is gated
// behind window.confirm.
describe("SessionCleanupDialog", () => {
  it("renders the thresholds form with no preview", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "清理会话" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "清理预览" })).not.toBeInTheDocument();
    // Archive-idle is enabled by default so its day input is editable.
    const archiveDays = screen.getByDisplayValue("30");
    expect(archiveDays).toBeEnabled();
  });

  it("keeps the delete-archived day input disabled until its toggle is on", async () => {
    const user = userEvent.setup();
    renderDialog();
    const deleteToggle = screen.getByRole("checkbox", { name: /删除已归档超过/ });
    const deleteDays = screen.getByDisplayValue("90");
    expect(deleteDays).toBeDisabled();
    await user.click(deleteToggle);
    expect(deleteDays).toBeEnabled();
  });

  it("previews with the validated request from the default draft", async () => {
    const user = userEvent.setup();
    const { onPreview } = renderDialog();
    await user.click(screen.getByRole("button", { name: "预览" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview.mock.calls[0]?.[0]).toEqual({ archiveIdleDays: 30, deleteArchivedDays: null });
  });

  it("blocks preview and shows an alert when no action is enabled", async () => {
    const user = userEvent.setup();
    const { onPreview } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: /归档空闲超过/ }));
    await user.click(screen.getByRole("button", { name: "预览" }));
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.getAllByText("Enable at least one cleanup action.").length).toBeGreaterThan(0);
  });

  it("updates the selected-projects count and totals when a project is deselected", async () => {
    const user = userEvent.setup();
    renderDialog({ preview, previewRequest });
    expect(screen.getByText("已选择 2 / 2 个项目")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "清理 /root/two" }));
    expect(screen.getByText("已选择 1 / 2 个项目")).toBeInTheDocument();
    // Selected totals reflect only /root/one (archive 3, delete 0).
    const table = screen.getByRole("table");
    const footer = within(table).getAllByRole("row").at(-1);
    expect(footer).not.toBeUndefined();
    if (footer === undefined) return;
    expect(within(footer).getByText("3")).toBeInTheDocument();
  });

  it("selects and deselects all projects", async () => {
    const user = userEvent.setup();
    renderDialog({ preview, previewRequest });
    await user.click(screen.getByRole("button", { name: "取消全选" }));
    expect(screen.getByText("已选择 0 / 2 个项目")).toBeInTheDocument();
    expect(screen.getByText("请至少选择一个项目再运行清理。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全选" }));
    expect(screen.getByText("已选择 2 / 2 个项目")).toBeInTheDocument();
  });

  it("disables Run cleanup until a fresh preview with targets exists", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "运行清理" })).toBeDisabled();
  });

  it("runs cleanup with the selected projects once confirmed", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    const { onRun } = renderDialog({ preview, previewRequest });
    const runButton = screen.getByRole("button", { name: "运行清理" });
    expect(runButton).toBeEnabled();
    await user.click(runButton);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0]?.[0]).toEqual({
      archiveIdleDays: 30,
      deleteArchivedDays: null,
      projectCwds: ["/root/one", "/root/two"],
    });
  });

  it("does not run when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => false);
    window.confirm = confirm;
    const { onRun } = renderDialog({ preview, previewRequest });
    await user.click(screen.getByRole("button", { name: "运行清理" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });
});
