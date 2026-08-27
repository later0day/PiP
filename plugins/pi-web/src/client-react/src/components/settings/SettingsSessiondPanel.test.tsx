import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsSessiondPanel } from "./SettingsSessiondPanel";
import type { PiWebConfigResponse, PiWebConfigValues } from "@shared/apiTypes";

// Ports the session-daemon settings panel to RTL. Three tool-capability toggles
// (spawn / subsessions / ask user) read from effectiveConfig with on-by-default
// semantics; each toggle saves immediately. Covers the loading/error/config-path
// states, the effective-summary, the spawn→subsessions dependency, and save.
const response = (over: Partial<PiWebConfigValues> = {}): PiWebConfigResponse => {
  const effectiveConfig: PiWebConfigValues = { spawnSessions: true, subsessions: true, askUser: true, ...over };
  return {
    path: "/etc/pi-web/config.json",
    exists: true,
    config: effectiveConfig,
    effectiveConfig,
    envOverrides: {
      host: false,
      port: false,
      allowedHosts: false,
      spawnSessions: false,
      subsessions: false,
      askUser: false,
    },
  };
};

describe("SettingsSessiondPanel", () => {
  const base = {
    loading: false,
    saving: false,
    error: "",
    savedMessage: "",
    targetLabel: "orchard-01",
    onReload: vi.fn(),
    onSave: vi.fn(),
  };

  it("shows a loading card while config is unavailable", () => {
    render(<SettingsSessiondPanel {...base} configResponse={undefined} loading />);
    expect(screen.getByText("正在加载配置…")).toBeInTheDocument();
  });

  it("renders the config path and all three capability toggles", () => {
    render(<SettingsSessiondPanel {...base} configResponse={response()} />);
    expect(screen.getByText("/etc/pi-web/config.json")).toBeInTheDocument();
    expect(screen.getByText("允许智能体启动会话")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "启用提问" })).toBeChecked();
  });

  it("surfaces an error banner", () => {
    render(<SettingsSessiondPanel {...base} configResponse={response()} error="save failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("save failed");
  });

  it("disables the subsessions toggle when spawn is off", () => {
    render(<SettingsSessiondPanel {...base} configResponse={response({ spawnSessions: false })} />);
    // Checkboxes render in order: spawn, subsessions, ask user.
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeDisabled();
  });

  it("saves a patch when a toggle flips", () => {
    const onSave = vi.fn<(config: PiWebConfigValues) => void>();
    render(<SettingsSessiondPanel {...base} configResponse={response()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "启用提问" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toEqual({ askUser: false });
  });
});
