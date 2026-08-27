import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsGeneralPanel } from "./SettingsGeneralPanel";
import type { PiWebConfigResponse, PiWebConfigValues } from "@shared/apiTypes";

// Ports the general-configuration settings panel to RTL. Two cards: gateway
// server (host/port/allowed-hosts, edits the local gateway) and selected-machine
// file access + uploads. Drafts reseed from the config responses. Covers the
// gateway loading state, the config paths, the effective-summary, save wiring,
// and the machine-config-unavailable placeholder.
const response = (over: Partial<PiWebConfigValues> = {}): PiWebConfigResponse => {
  const config: PiWebConfigValues = { host: "0.0.0.0", port: 9000, ...over };
  return {
    path: "/etc/pi-web/config.json",
    exists: true,
    config,
    effectiveConfig: config,
    envOverrides: { host: false, port: false, allowedHosts: false, spawnSessions: false, subsessions: false, askUser: false },
  };
};

const machineResponse = (): PiWebConfigResponse => ({
  path: "/home/pi/.pi-web/machine.json",
  exists: true,
  config: { pathAccess: { allowedPaths: ["/opt/ref"] } },
  effectiveConfig: { pathAccess: { allowedPaths: ["/opt/ref"] } },
  envOverrides: { host: false, port: false, allowedHosts: false, spawnSessions: false, subsessions: false, askUser: false },
});

describe("SettingsGeneralPanel", () => {
  const base = {
    loading: false,
    machineLoading: false,
    saving: false,
    error: "",
    machineError: "",
    savedMessage: "",
    targetLabel: "orchard-01",
    onReload: vi.fn(),
    onReloadMachine: vi.fn(),
    onSave: vi.fn(),
    onSaveMachineConfig: vi.fn(),
  };

  it("shows the gateway loading card while config is loading", () => {
    render(
      <SettingsGeneralPanel {...base} configResponse={undefined} machineConfigResponse={undefined} loading />,
    );
    expect(screen.getByText("正在加载网关配置…")).toBeInTheDocument();
  });

  it("renders both config paths and the host draft when loaded", () => {
    render(
      <SettingsGeneralPanel {...base} configResponse={response()} machineConfigResponse={machineResponse()} />,
    );
    expect(screen.getByText("/etc/pi-web/config.json")).toBeInTheDocument();
    expect(screen.getByText("/home/pi/.pi-web/machine.json")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.0.0.0")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9000")).toBeInTheDocument();
  });

  it("surfaces a gateway error as an alert", () => {
    render(
      <SettingsGeneralPanel {...base} configResponse={response()} machineConfigResponse={machineResponse()} error="bad port" />,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => a.textContent.includes("bad port"))).toBe(true);
  });

  it("saves the gateway config on submit", () => {
    const onSave = vi.fn<(config: PiWebConfigValues) => void>();
    render(
      <SettingsGeneralPanel {...base} configResponse={response()} machineConfigResponse={machineResponse()} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "保存网关服务器配置" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the machine-config-unavailable placeholder", () => {
    render(
      <SettingsGeneralPanel {...base} configResponse={response()} machineConfigResponse={undefined} />,
    );
    expect(
      screen.getByText("选中机器的文件访问配置不可用。请在保存文件/上传设置前重新加载。"),
    ).toBeInTheDocument();
  });
});
