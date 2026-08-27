import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ToolExecutionPart } from "@client/components/shared";
import { ToolExecutionCard } from "./ToolExecutionCard";

const execution = (over: Partial<ToolExecutionPart> & Pick<ToolExecutionPart, "toolName" | "status">): ToolExecutionPart => ({
  type: "toolExecution",
  summary: "",
  ...over,
});

// Ports the ToolExecutionCard (beautifului ToolChips #5) structure to RTL: the
// status header + label, the File/Command/Input target, the +/- diff stats with
// a rendered diff body, the edit-count meta, and the error surface.
describe("ToolExecutionCard", () => {
  it("renders the tool name, a File target, and a done status", () => {
    render(<ToolExecutionCard execution={execution({ toolName: "read", status: "success", args: { path: "/root/a.ts" } })} />);
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByLabelText("文件：/root/a.ts")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("shows a Command target for shell tools", () => {
    render(<ToolExecutionCard execution={execution({ toolName: "bash", status: "running", args: { command: "ls -la" } })} />);
    expect(screen.getByLabelText("命令：ls -la")).toBeInTheDocument();
    expect(screen.getByText("运行中")).toBeInTheDocument();
  });

  it("renders diff stats and the applied diff body", () => {
    const diff = "+added line\n-removed line\n context";
    render(<ToolExecutionCard execution={execution({ toolName: "edit", status: "success", args: { path: "/root/a.ts" }, details: { diff } })} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByLabelText("应用的 diff")).toBeInTheDocument();
  });

  it("labels a preview-only diff as a Preview diff", () => {
    render(
      <ToolExecutionCard
        execution={execution({ toolName: "edit", status: "pending", args: { path: "/root/a.ts" }, preview: { diff: "+one\n-two" } })}
      />,
    );
    expect(screen.getByLabelText("预览 diff")).toBeInTheDocument();
  });

  it("shows the edit count for multi-edit tools", () => {
    render(
      <ToolExecutionCard
        execution={execution({ toolName: "edit", status: "success", args: { path: "/root/a.ts", edits: [{}, {}, {}] } })}
      />,
    );
    expect(screen.getByText("3 处修改")).toBeInTheDocument();
  });

  it("surfaces the error text and failed status", () => {
    render(<ToolExecutionCard execution={execution({ toolName: "bash", status: "error", resultText: "command not found", summary: "ls" })} />);
    // The error text shows in the error banner (and again in the auto-open details).
    expect(screen.getAllByText("command not found").length).toBeGreaterThan(0);
    expect(screen.getByText("失败")).toBeInTheDocument();
  });

  it("expands a long diff via Show all", async () => {
    const user = userEvent.setup();
    const diff = Array.from({ length: 200 }, (_, index) => `+line ${String(index)}`).join("\n");
    render(<ToolExecutionCard execution={execution({ toolName: "edit", status: "success", args: { path: "/root/a.ts" }, details: { diff } })} />);
    const showAll = screen.getByRole("button", { name: /显示全部 200 行 diff/ });
    await user.click(showAll);
    expect(screen.queryByRole("button", { name: /显示全部/ })).not.toBeInTheDocument();
  });
});
