import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MachineDialog,
  machineBaseUrlValidationMessage,
  suggestedMachineNameFromUrl,
} from "./MachineDialog";

// Ports MachineDialog.test.ts to RTL: the pure URL helpers plus the form flow —
// URL field focus, name suggestion, Enter-to-advance, validation hint, optional
// token, and a valid submit.
describe("suggestedMachineNameFromUrl", () => {
  it("suggests the host without protocol or port", () => {
    expect(suggestedMachineNameFromUrl("http://127.0.0.1:8504")).toBe("127.0.0.1");
    expect(suggestedMachineNameFromUrl("https://devbox.example.test:8504/pi-web")).toBe("devbox.example.test");
  });

  it("also suggests a host while the URL protocol is being typed", () => {
    expect(suggestedMachineNameFromUrl("devbox.local:8504")).toBe("devbox.local");
  });
});

describe("machineBaseUrlValidationMessage", () => {
  it("accepts http and https base URLs", () => {
    expect(machineBaseUrlValidationMessage("http://127.0.0.1:8504")).toBeUndefined();
    expect(machineBaseUrlValidationMessage("https://devbox.example.test/pi-web")).toBeUndefined();
  });

  it("explains invalid machine URLs", () => {
    expect(machineBaseUrlValidationMessage("")).toBe("需要填写远程 PI WEB 地址。");
    expect(machineBaseUrlValidationMessage("devbox.local:8504")).toBe("请使用 http:// 或 https:// 地址。");
    expect(machineBaseUrlValidationMessage("ftp://devbox.example.test")).toBe("请使用 http:// 或 https:// 地址。");
    expect(machineBaseUrlValidationMessage("https://user@devbox.example.test")).toBe("机器地址中不要包含凭据。");
    expect(machineBaseUrlValidationMessage("https://devbox.example.test?q=1")).toBe("不要包含查询字符串或片段。");
  });
});

describe("MachineDialog", () => {
  it("focuses the base URL field and hides the name field until a URL is entered", () => {
    render(<MachineDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const url = screen.getByRole("textbox", { name: "远程 PI WEB 地址" });
    expect(url).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: "机器名称" })).not.toBeInTheDocument();
  });

  it("suggests a machine name from the URL", async () => {
    const user = userEvent.setup();
    render(<MachineDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "远程 PI WEB 地址" }), "http://devbox.local:8504");
    expect(screen.getByRole("textbox", { name: "机器名称" })).toHaveValue("devbox.local");
  });

  it("shows a validation hint for an invalid URL", async () => {
    const user = userEvent.setup();
    render(<MachineDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "远程 PI WEB 地址" }), "ftp://devbox");
    expect(screen.getByText("请使用 http:// 或 https:// 地址。")).toBeInTheDocument();
  });

  it("moves focus to the machine name on Enter in a valid base URL", async () => {
    const user = userEvent.setup();
    render(<MachineDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const url = screen.getByRole("textbox", { name: "远程 PI WEB 地址" });
    await user.type(url, "http://devbox.local:8504");
    await user.type(url, "{Enter}");
    expect(screen.getByRole("textbox", { name: "机器名称" })).toHaveFocus();
  });

  it("submits the trimmed name, base URL, and token", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MachineDialog onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "远程 PI WEB 地址" }), "http://devbox.local:8504");
    const token = screen.getByLabelText(/Bearer 令牌/);
    await user.type(token, "secret-token");
    await user.click(screen.getByRole("button", { name: "添加机器" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "devbox.local",
      baseUrl: "http://devbox.local:8504",
      token: "secret-token",
    });
  });

  it("keeps Add machine disabled until the URL is valid", async () => {
    const user = userEvent.setup();
    render(<MachineDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "添加机器" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "远程 PI WEB 地址" }), "ftp://devbox");
    expect(screen.getByRole("button", { name: "添加机器" })).toBeDisabled();
  });

  it("cancels via the close button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<MachineDialog onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
