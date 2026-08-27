import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PromptAttachment, PromptAttachmentDelivery, SessionModel } from "@shared/apiTypes";
import type { CompletionsController } from "../../state/useCompletions";
import type { AttachmentsController } from "../../state/useAttachments";

// Ports the PromptComposer to RTL. It's a textarea composer (not CodeMirror):
// enter-to-send, per-session draft, send/steer/stop, model/thinking status row,
// and completion + attachment seams. The useCompletions / useAttachments hooks
// hit apis, so they're stubbed with inert controllers; the draft/send/steer/stop
// wiring is real. localStorage is provided by happy-dom.
const completions: CompletionsController = {
  items: [],
  selectedIndex: 0,
  refresh: vi.fn(),
  clear: vi.fn(),
  move: vi.fn(),
  setSelectedIndex: vi.fn(),
};

let attachmentsList: AttachmentsController["attachments"] = [];
const attachments: AttachmentsController = {
  get attachments() {
    return attachmentsList;
  },
  error: undefined,
  delivery: "inline",
  effectiveDelivery: "inline",
  addFiles: vi.fn<(files: readonly File[]) => Promise<void>>().mockResolvedValue(undefined),
  remove: vi.fn(),
  changeDelivery: vi.fn(),
  toPromptAttachments: vi.fn<() => PromptAttachment[]>().mockReturnValue([]),
  clear: vi.fn(),
};

vi.mock("../../state/useCompletions", () => ({ useCompletions: () => completions }));
vi.mock("../../state/useAttachments", () => ({ useAttachments: () => attachments }));

const { PromptComposer } = await import("./PromptComposer");

const baseProps = {
  sessionId: "s1",
  machineId: "local",
  cwd: "/root/orchard",
  sending: false,
  onSend: vi.fn(),
};

describe("PromptComposer", () => {
  beforeEach(() => {
    attachmentsList = [];
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the message textarea", () => {
    render(<PromptComposer {...baseProps} onSend={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "给 pi 发送消息" })).toBeInTheDocument();
  });

  it("disables the send button when the draft is empty", () => {
    render(<PromptComposer {...baseProps} onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  });

  it("enables and fires send with the typed text", () => {
    const onSend = vi.fn<(text: string, behavior?: "steer" | "followUp", attachments?: PromptAttachment[], delivery?: PromptAttachmentDelivery) => void>();
    render(<PromptComposer {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: "给 pi 发送消息" });
    fireEvent.change(textarea, { target: { value: "Churn pistachio" } });
    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]?.[0]).toBe("Churn pistachio");
  });

  it("shows the model status button and fires the picker", () => {
    const onSelectModel = vi.fn<() => void>();
    const model: SessionModel = { provider: "qwen", id: "qwen-max" };
    render(<PromptComposer {...baseProps} onSend={vi.fn()} model={model} onSelectModel={onSelectModel} />);
    const modelButton = screen.getByRole("button", { name: "qwen/qwen-max" });
    expect(modelButton).toHaveAttribute("title", "选择模型");
    fireEvent.click(modelButton);
    expect(onSelectModel).toHaveBeenCalledTimes(1);
  });

  it("shows a steer button while a response is streaming and fires steer", () => {
    const onSend = vi.fn<(text: string, behavior?: "steer" | "followUp") => void>();
    render(<PromptComposer {...baseProps} onSend={onSend} canSteer />);
    fireEvent.change(screen.getByRole("textbox", { name: "给 pi 发送消息" }), { target: { value: "actually, vanilla" } });
    const steer = screen.getByRole("button", { name: "引导当前回复" });
    fireEvent.click(steer);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]?.[1]).toBe("steer");
  });

  it("fires stop when there is running work", () => {
    const onStop = vi.fn<() => void>();
    render(<PromptComposer {...baseProps} onSend={vi.fn()} canStop onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "停止当前工作" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
