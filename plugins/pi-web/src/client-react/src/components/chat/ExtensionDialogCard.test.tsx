import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ExtensionDialogAnswer, PendingExtensionDialog } from "@shared/apiTypes";
import { ExtensionDialogCard, extensionDialogCountdownText } from "./ExtensionDialogCard";

const confirmDialog: PendingExtensionDialog = {
  dialogId: "d1",
  kind: "confirm",
  title: "Proceed?",
  message: "This runs the migration.",
  askedAt: "2026-08-27T00:00:00Z",
  runScoped: false,
};

const selectDialog: PendingExtensionDialog = {
  dialogId: "d2",
  kind: "select",
  title: "Pick one",
  options: ["Alpha", "Beta"],
  askedAt: "2026-08-27T00:00:00Z",
  runScoped: false,
};

const inputDialog: PendingExtensionDialog = {
  dialogId: "d3",
  kind: "input",
  title: "Name it",
  placeholder: "type here",
  askedAt: "2026-08-27T00:00:00Z",
  runScoped: false,
};

function handlers(): {
  onAnswer: ReturnType<typeof vi.fn<(dialogId: string, value: ExtensionDialogAnswer) => void>>;
  onCancel: ReturnType<typeof vi.fn<(dialogId: string) => void>>;
} {
  return {
    onAnswer: vi.fn<(dialogId: string, value: ExtensionDialogAnswer) => void>(),
    onCancel: vi.fn<(dialogId: string) => void>(),
  };
}

// Ports ExtensionDialogCard.test.ts to RTL: the pure countdown helper plus the
// confirm/select/input dialog kinds, cancel wiring, and input submission.
describe("extensionDialogCountdownText", () => {
  it("returns undefined without a deadline and formats remaining time", () => {
    expect(extensionDialogCountdownText(undefined, 0)).toBeUndefined();
    const now = Date.parse("2026-08-27T00:00:00Z");
    expect(extensionDialogCountdownText("2026-08-27T00:00:45Z", now)).toBe("45 秒后自动取消");
    expect(extensionDialogCountdownText("2026-08-27T00:02:05Z", now)).toBe("2 分 5 秒后自动取消");
    expect(extensionDialogCountdownText("2026-08-27T00:00:00Z", now)).toBe("即将自动取消");
  });
});

describe("ExtensionDialogCard", () => {
  it("answers Yes and No on a confirm dialog", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<ExtensionDialogCard dialog={confirmDialog} {...h} />);
    expect(screen.getByText("This runs the migration.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "是" }));
    expect(h.onAnswer).toHaveBeenCalledWith("d1", true);
  });

  it("answers a select dialog with the chosen option", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<ExtensionDialogCard dialog={selectDialog} {...h} />);
    await user.click(screen.getByRole("button", { name: "Beta" }));
    expect(h.onAnswer).toHaveBeenCalledWith("d2", "Beta");
  });

  it("submits the typed value on an input dialog", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<ExtensionDialogCard dialog={inputDialog} {...h} />);
    await user.type(screen.getByRole("textbox", { name: "你的回答" }), "hello");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(h.onAnswer).toHaveBeenCalledWith("d3", "hello");
  });

  it("cancels the dialog", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<ExtensionDialogCard dialog={selectDialog} {...h} />);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(h.onCancel).toHaveBeenCalledWith("d2");
  });

  it("shows the auto-cancel countdown when a timeout is pending", () => {
    const future = new Date(Date.now() + 45_000).toISOString();
    const h = handlers();
    render(<ExtensionDialogCard dialog={{ ...confirmDialog, timeoutAt: future }} {...h} />);
    expect(screen.getByText(/后自动取消/)).toBeInTheDocument();
  });
});
