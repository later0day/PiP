import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PendingAskUser } from "@shared/apiTypes";
import { AskUserCard } from "./AskUserCard";

const ask: PendingAskUser = {
  askId: "ask-1",
  askedAt: "2026-08-27T00:00:00Z",
  questions: [
    {
      id: "flavor",
      question: "Pick a flavor",
      options: [
        { value: "pistachio", label: "Pistachio" },
        { value: "vanilla", label: "Vanilla" },
      ],
    },
    {
      id: "toppings",
      question: "Pick toppings",
      multiple: true,
      options: [
        { value: "nuts", label: "Nuts" },
        { value: "fudge", label: "Fudge" },
      ],
    },
  ],
};

afterEach(() => {
  localStorage.clear();
});

// Ports ChatView.askUser.test.ts interaction to RTL: question render + answered
// counter, single/multi select, the Custom free-text branch, the partial-submit
// confirmation gate, and a full submit calling onSubmit with the submission.
describe("AskUserCard", () => {
  it("renders each question and the answered counter", () => {
    render(<AskUserCard ask={ask} draftSessionId="" onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "提问" })).toBeInTheDocument();
    expect(screen.getByText("已回答 0 / 2")).toBeInTheDocument();
    expect(screen.getByText("Pick a flavor")).toBeInTheDocument();
    expect(screen.getByText("Pick toppings")).toBeInTheDocument();
  });

  it("records a single-select answer and updates the counter", async () => {
    const user = userEvent.setup();
    render(<AskUserCard ask={ask} draftSessionId="" onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Pistachio" }));
    expect(screen.getByText("已回答 1 / 2")).toBeInTheDocument();
  });

  it("gates submit behind a partial-answer confirmation when questions are unanswered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AskUserCard ask={ask} draftSessionId="" onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "发送回答" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "确认部分回答" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "仍然发送" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toBe("ask-1");
  });

  it("submits directly once every question is answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AskUserCard ask={ask} draftSessionId="" onSubmit={onSubmit} />);
    await user.click(screen.getByRole("radio", { name: "Pistachio" }));
    await user.click(screen.getByRole("checkbox", { name: "Nuts" }));
    expect(screen.getByText("已回答 2 / 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发送回答" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reveals a free-text field when Custom is chosen", async () => {
    const user = userEvent.setup();
    render(<AskUserCard ask={ask} draftSessionId="" onSubmit={vi.fn()} />);
    const flavor = screen.getByText("Pick a flavor").closest("fieldset");
    expect(flavor).not.toBeNull();
    if (flavor === null) return;
    await user.click(within(flavor).getByRole("radio", { name: "自定义" }));
    expect(within(flavor).getByRole("textbox")).toBeInTheDocument();
  });

  it("persists the draft under the session key and restores it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AskUserCard ask={ask} draftSessionId="local:s1" onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Vanilla" }));
    expect(screen.getByText("已回答 1 / 2")).toBeInTheDocument();
    unmount();
    render(<AskUserCard ask={ask} draftSessionId="local:s1" onSubmit={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Vanilla" })).toBeChecked();
    expect(screen.getByText("已回答 1 / 2")).toBeInTheDocument();
  });
});
