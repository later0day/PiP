import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppAction } from "@client/actions";
import type { PiWebConfigResponse, PiWebConfigValues } from "@shared/apiTypes";
import { PROMPT_ENTER_PREFERENCE_STORAGE_KEY } from "@client/promptEnterBehavior";
import { SettingsShortcutsPanel } from "./SettingsShortcutsPanel";

const action = (over: Partial<AppAction> & Pick<AppAction, "id" | "title">): AppAction => ({
  run: () => undefined,
  ...over,
});

const ACTIONS: AppAction[] = [
  action({ id: "chat.new", title: "New chat", shortcut: "mod+n", group: "Session" }),
  action({ id: "chat.search", title: "Search actions", shortcut: "mod+k", group: "Session" }),
];

function configResponse(over: Partial<PiWebConfigValues> = {}): PiWebConfigResponse {
  const config: PiWebConfigValues = { ...over };
  return {
    path: "/root/.config/pi-web/config.json",
    exists: true,
    config,
    effectiveConfig: config,
    envOverrides: { host: false, port: false, allowedHosts: false, spawnSessions: false, subsessions: false, askUser: false },
  };
}

function renderPanel(over: Partial<React.ComponentProps<typeof SettingsShortcutsPanel>> = {}): {
  onReload: ReturnType<typeof vi.fn<() => void>>;
  onSave: ReturnType<typeof vi.fn<(config: PiWebConfigValues) => void>>;
} {
  const onReload = vi.fn<() => void>();
  const onSave = vi.fn<(config: PiWebConfigValues) => void>();
  render(
    <SettingsShortcutsPanel
      actions={ACTIONS}
      configResponse={configResponse()}
      loading={false}
      saving={false}
      error=""
      savedMessage=""
      onReload={onReload}
      onSave={onSave}
      {...over}
    />,
  );
  return { onReload, onSave };
}

afterEach(() => {
  localStorage.clear();
});

// Ports SettingsShortcutsPanel.test.ts to RTL: the per-action rows + defaults,
// the composer Enter-key preference persistence, draft input gating Save, and
// the reload/save/none wiring through the reused shortcut + prompt-enter modules.
describe("SettingsShortcutsPanel", () => {
  it("renders a grouped row per action with its default shortcut", () => {
    renderPanel();
    expect(screen.getByRole("region", { name: "键盘快捷键" })).toBeInTheDocument();
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText("Search actions")).toBeInTheDocument();
    // Each row exposes an editable Shortcut input seeded with the default.
    const inputs = screen.getAllByRole("textbox", { name: "快捷键" });
    expect(inputs).toHaveLength(2);
  });

  it("persists the composer Enter-key preference on change", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("radio", { name: /Enter 发送消息/ }));
    expect(localStorage.getItem(PROMPT_ENTER_PREFERENCE_STORAGE_KEY)).toBe("send");
  });

  it("keeps Save disabled until a shortcut draft is edited", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel();
    const newChatRow = screen.getByText("New chat").closest("article");
    expect(newChatRow).not.toBeNull();
    if (newChatRow === null) return;
    const save = within(newChatRow).getByRole("button", { name: "保存" });
    expect(save).toBeDisabled();
    const input = within(newChatRow).getByRole("textbox", { name: "快捷键" });
    await user.clear(input);
    await user.type(input, "mod+shift+n");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]?.shortcuts?.["chat.new"]).toBe("mod+shift+n");
  });

  it("saves a null preference when disabling with None", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ configResponse: configResponse({ shortcuts: { "chat.new": "mod+n" } }) });
    const newChatRow = screen.getByText("New chat").closest("article");
    expect(newChatRow).not.toBeNull();
    if (newChatRow === null) return;
    await user.click(within(newChatRow).getByRole("button", { name: "无" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]?.shortcuts?.["chat.new"]).toBeNull();
  });

  it("reloads on demand", async () => {
    const user = userEvent.setup();
    const { onReload } = renderPanel();
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error notice", () => {
    renderPanel({ error: "Could not save config." });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save config.");
  });
});
