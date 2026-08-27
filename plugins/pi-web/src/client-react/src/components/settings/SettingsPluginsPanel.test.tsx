import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPluginsPanel } from "./SettingsPluginsPanel";
import type { PiWebConfigResponse, PiWebPluginInfo, PiWebPluginsResponse } from "@shared/apiTypes";

// Ports the PI WEB plugins settings panel to RTL. Lists discovered/configured
// plugins with a desired-enable toggle, prints the trusted-code security warning
// and offline recovery commands, and surfaces error/availability notices. Covers
// the empty state, the plugin row + toggle, the trusted-code warning, and toggle.
const recovery = {
  showSafeStart: "pi web config plugins:safe-start show",
  bundledOnly: "pi web config plugins:safe-start bundled-only",
  noServerPlugins: "pi web config plugins:safe-start none",
  clearSafeStart: "pi web config plugins:safe-start off",
};

const plugin = (over: Partial<PiWebPluginInfo> = {}): PiWebPluginInfo => ({
  id: "pi-web-git",
  source: "package",
  scope: "local",
  machineSpecific: false,
  enabled: true,
  discovered: true,
  conflict: false,
  ...over,
});

const pluginsResponse = (plugins: PiWebPluginInfo[]): PiWebPluginsResponse => ({
  lifecycleVersion: 1,
  plugins,
  diagnostics: [],
  serverRuntime: { status: "available", restartRequired: false, recovery },
});

const configResponse = (): PiWebConfigResponse => ({
  path: "/etc/pi-web/config.json",
  exists: true,
  config: {},
  effectiveConfig: {},
  envOverrides: { host: false, port: false, allowedHosts: false, spawnSessions: false, subsessions: false, askUser: false },
});

describe("SettingsPluginsPanel", () => {
  const base = {
    loading: false,
    saving: false,
    recoveryCommandsSupported: true,
    error: "",
    savedMessage: "",
    targetLabel: "orchard-01",
    onReload: vi.fn(),
    onTogglePlugin: vi.fn(),
  };

  it("shows the loading card while plugins are unavailable", () => {
    render(<SettingsPluginsPanel {...base} pluginsResponse={undefined} configResponse={undefined} loading />);
    expect(screen.getByText("正在加载 PI WEB 插件…")).toBeInTheDocument();
  });

  it("renders a plugin row with its id and desired-enabled toggle", () => {
    render(
      <SettingsPluginsPanel
        {...base}
        pluginsResponse={pluginsResponse([plugin()])}
        configResponse={configResponse()}
      />,
    );
    expect(screen.getByText("pi-web-git")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("期望启用")).toBeInTheDocument();
  });

  it("prints the trusted-code security warning when plugins exist", () => {
    render(
      <SettingsPluginsPanel
        {...base}
        pluginsResponse={pluginsResponse([plugin()])}
        configResponse={configResponse()}
      />,
    );
    expect(screen.getByText("可信代码警告：")).toBeInTheDocument();
  });

  it("surfaces an error notice as an alert", () => {
    render(
      <SettingsPluginsPanel
        {...base}
        pluginsResponse={pluginsResponse([plugin()])}
        configResponse={configResponse()}
        error="plugin load failed"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("plugin load failed");
  });

  it("toggles a plugin's desired enablement", () => {
    const onTogglePlugin = vi.fn<(id: string, enabled: boolean) => void>();
    render(
      <SettingsPluginsPanel
        {...base}
        pluginsResponse={pluginsResponse([plugin()])}
        configResponse={configResponse()}
        onTogglePlugin={onTogglePlugin}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onTogglePlugin).toHaveBeenCalledTimes(1);
    expect(onTogglePlugin.mock.calls[0]?.[0]).toBe("pi-web-git");
    expect(onTogglePlugin.mock.calls[0]?.[1]).toBe(false);
  });
});
