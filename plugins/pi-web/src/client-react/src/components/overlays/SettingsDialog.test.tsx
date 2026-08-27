import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SettingsState } from "../../state/useSettings";

// Ports the SettingsDialog frame to RTL. A 5-section nav (general / sessiond /
// packages / plugins / shortcuts) on the shared ModalSurface; the active section
// renders its panel. useSettings hits apis, so it's stubbed with an inert state
// object; the nav selection + close wiring is real. Section is a controlled prop
// driven by the URL through onNavigate.
const settings: SettingsState = {
  target: { id: "local", name: "local", kind: "local" },
  targetLabel: "local (local gateway)",
  configResponse: undefined,
  accessConfigResponse: undefined,
  loading: false,
  accessLoading: false,
  saving: false,
  error: "",
  accessError: "",
  savedMessage: "",
  reloadConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  reloadAccessConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveMachineAccessConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sessiondConfigResponse: undefined,
  sessiondLoading: false,
  sessiondError: "",
  reloadSessiondConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveSessiondConfig: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  pluginConfigResponse: undefined,
  pluginsResponse: undefined,
  pluginLoading: false,
  pluginError: "",
  recoveryCommandsSupported: true,
  reloadPlugins: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  togglePlugin: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  packagesResponse: undefined,
  packageTarget: { id: "local", name: "local", kind: "local" },
  packageLoading: false,
  packageOperation: undefined,
  packageError: "",
  packageMessage: "",
  reloadPackages: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  installPiPackage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  removePiPackage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  updatePiPackage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

vi.mock("../../state/useSettings", () => ({ useSettings: () => settings }));

const { SettingsDialog } = await import("./SettingsDialog");

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all five section nav buttons", () => {
    render(<SettingsDialog section="general" actions={[]} onNavigate={vi.fn()} onClose={vi.fn()} />);
    for (const label of ["常规", "会话守护进程", "Pi 软件包", "PI WEB 插件", "键盘"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks the active section with aria-current", () => {
    render(<SettingsDialog section="sessiond" actions={[]} onNavigate={vi.fn()} onClose={vi.fn()} />);
    const active = screen.getByRole("button", { name: /会话守护进程/ });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("renders the general panel for the general section", () => {
    render(<SettingsDialog section="general" actions={[]} onNavigate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("region", { name: "常规配置" })).toBeInTheDocument();
  });

  it("renders the sessiond panel for the sessiond section", () => {
    render(<SettingsDialog section="sessiond" actions={[]} onNavigate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("region", { name: "会话守护进程" })).toBeInTheDocument();
  });

  it("navigates to another section on nav click", () => {
    const onNavigate = vi.fn<(section: string) => void>();
    render(<SettingsDialog section="general" actions={[]} onNavigate={onNavigate} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pi 软件包/ }));
    expect(onNavigate).toHaveBeenCalledWith("packages");
  });

  it("closes via the close button", () => {
    const onClose = vi.fn<() => void>();
    render(<SettingsDialog section="general" actions={[]} onNavigate={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭设置" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
