import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthDialogState } from "@client/appState";
import type { AuthProviderOption, AuthType, OAuthFlowState } from "@shared/apiTypes";
import { AuthDialog } from "./AuthDialog";

const provider = (over: Partial<AuthProviderOption> & Pick<AuthProviderOption, "id" | "name">): AuthProviderOption => ({
  authType: "oauth",
  status: { configured: false },
  ...over,
});

const PROVIDERS: AuthProviderOption[] = [
  provider({ id: "anthropic", name: "Anthropic", authType: "oauth" }),
  provider({ id: "openai", name: "OpenAI", authType: "api_key" }),
];

function handlers(): {
  onChooseMethod: ReturnType<typeof vi.fn<(authType: AuthType) => void>>;
  onSelectProvider: ReturnType<typeof vi.fn<(providerId: string, authType: AuthType) => void>>;
  onLogoutProvider: ReturnType<typeof vi.fn<(providerId: string) => void>>;
  onOAuthInput: ReturnType<typeof vi.fn<(value: string) => void>>;
  onOAuthRespond: ReturnType<typeof vi.fn<(value?: string) => void>>;
  onOAuthCancel: ReturnType<typeof vi.fn<() => void>>;
  onCancel: ReturnType<typeof vi.fn<() => void>>;
} {
  return {
    onChooseMethod: vi.fn<(authType: AuthType) => void>(),
    onSelectProvider: vi.fn<(providerId: string, authType: AuthType) => void>(),
    onLogoutProvider: vi.fn<(providerId: string) => void>(),
    onOAuthInput: vi.fn<(value: string) => void>(),
    onOAuthRespond: vi.fn<(value?: string) => void>(),
    onOAuthCancel: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
  };
}

function renderDialog(state: AuthDialogState): ReturnType<typeof handlers> {
  const h = handlers();
  render(<AuthDialog state={state} {...h} />);
  return h;
}

// Ports AuthDialog.test.ts to RTL: the method chooser, the searchable provider
// list with roving keyboard selection, the logout list empty state, and the
// oauth flow's auth-link + prompt input surfaces.
describe("AuthDialog", () => {
  it("offers the two authentication methods and dispatches the choice", async () => {
    const user = userEvent.setup();
    const h = renderDialog({ step: "method", machineId: "local" });
    expect(screen.getByRole("dialog", { name: "配置服务商认证" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /使用订阅/ }));
    expect(h.onChooseMethod).toHaveBeenCalledWith("oauth");
  });

  it("lists providers and selects one with its authType", async () => {
    const user = userEvent.setup();
    const h = renderDialog({ step: "providers", mode: "login", machineId: "local", providers: PROVIDERS });
    await user.click(screen.getByRole("button", { name: /OpenAI/ }));
    expect(h.onSelectProvider).toHaveBeenCalledWith("openai", "api_key");
  });

  it("filters the provider list via the search box", async () => {
    const user = userEvent.setup();
    renderDialog({ step: "providers", mode: "login", machineId: "local", providers: PROVIDERS });
    await user.type(screen.getByRole("textbox", { name: "搜索服务商" }), "anthro");
    expect(screen.getByRole("button", { name: /Anthropic/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /OpenAI/ })).not.toBeInTheDocument();
  });

  it("moves the roving selection with arrow keys", async () => {
    const user = userEvent.setup();
    renderDialog({ step: "providers", mode: "login", machineId: "local", providers: PROVIDERS });
    // Arrow keys from the search input are ignored by design, so drive the
    // roving selection from a focused option button.
    const first = screen.getByRole("button", { name: /Anthropic/ });
    first.focus();
    expect(first).toHaveAttribute("aria-current", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /OpenAI/ })).toHaveAttribute("aria-current", "true");
    await user.keyboard("{ArrowUp}");
    expect(first).toHaveAttribute("aria-current", "true");
  });

  it("shows the empty state when there are no stored credentials to remove", () => {
    renderDialog({ step: "logout", machineId: "local", providers: [] });
    expect(screen.getByText(/没有已存储的凭据/)).toBeInTheDocument();
  });

  it("renders the oauth authorization link and prompt input", async () => {
    const user = userEvent.setup();
    const flow: OAuthFlowState = {
      flowId: "flow-1",
      providerId: "anthropic",
      providerName: "Anthropic",
      status: "running",
      auth: { url: "https://auth.example/login" },
      prompt: { requestId: "req-1", message: "Paste the code", promptType: "manual_code" },
      progress: [],
    };
    const h = renderDialog({ step: "oauth", flow, machineId: "local" });
    expect(screen.getByRole("dialog", { name: "登录到 Anthropic" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://auth.example/login" })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("");
    await user.type(input, "abc");
    expect(h.onOAuthInput).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "提交" }));
    expect(h.onOAuthRespond).toHaveBeenCalled();
  });

  it("cancels the oauth flow rather than the whole dialog on close", async () => {
    const user = userEvent.setup();
    const flow: OAuthFlowState = {
      flowId: "flow-1",
      providerId: "anthropic",
      providerName: "Anthropic",
      status: "running",
      auth: { url: "https://auth.example/login" },
      progress: [],
    };
    const h = renderDialog({ step: "oauth", flow, machineId: "local" });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "关闭" }));
    expect(h.onOAuthCancel).toHaveBeenCalledTimes(1);
    expect(h.onCancel).not.toHaveBeenCalled();
  });
});
