import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPackagesPanel } from "./SettingsPackagesPanel";
import type { PiPackageInfo, PiPackagesResponse } from "@shared/apiTypes";
import type { PiPackageTargetContext } from "@client/components/settings/piPackageSettings";

// Ports the Pi packages settings panel to RTL. Covers the loading card, the
// trusted-code warning, the configured-package list with per-package Update /
// Remove, the free-form install form (client-side validation + submit), and the
// empty-list state. Enablement/label logic comes from piPackageSettings.
const target: PiPackageTargetContext = { id: "local", name: "local", kind: "local" };

const pkg = (over: Partial<PiPackageInfo> = {}): PiPackageInfo => ({
  source: "npm:@pi/git",
  scope: "user",
  filtered: false,
  installedPath: "/home/pi/.pi/packages/git",
  ...over,
});

const response = (packages: PiPackageInfo[]): PiPackagesResponse => ({ packages });

describe("SettingsPackagesPanel", () => {
  const base = {
    loading: false,
    operation: undefined,
    targetMachine: target,
    error: "",
    operationMessage: "",
    onReload: vi.fn(),
    onInstallPackage: vi.fn(),
    onRemovePackage: vi.fn(),
    onUpdatePackage: vi.fn(),
  };

  it("shows a loading card while the package list is unavailable", () => {
    render(<SettingsPackagesPanel {...base} packagesResponse={undefined} loading />);
    expect(screen.getByText(/正在从 local.*加载 Pi 软件包/)).toBeInTheDocument();
  });

  it("renders the trusted-code warning and install form once loaded", () => {
    render(<SettingsPackagesPanel {...base} packagesResponse={response([])} />);
    expect(screen.getByText("可信代码警告：")).toBeInTheDocument();
    expect(screen.getByLabelText("Pi 软件包来源")).toBeInTheDocument();
  });

  it("lists a configured package with Update and Remove actions", () => {
    render(<SettingsPackagesPanel {...base} packagesResponse={response([pkg()])} />);
    expect(screen.getByText("npm:@pi/git")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除" })).toBeInTheDocument();
  });

  it("shows a validation message when installing an empty source", () => {
    render(<SettingsPackagesPanel {...base} packagesResponse={response([])} />);
    fireEvent.click(screen.getByRole("button", { name: "安装" }));
    expect(screen.getByText(/请输入 Pi 接受的 Pi 软件包来源/)).toBeInTheDocument();
    expect(base.onInstallPackage).not.toHaveBeenCalled();
  });

  it("installs a typed source", () => {
    const onInstallPackage = vi.fn<(source: string) => void>();
    render(<SettingsPackagesPanel {...base} packagesResponse={response([])} onInstallPackage={onInstallPackage} />);
    fireEvent.change(screen.getByLabelText("Pi 软件包来源"), { target: { value: "npm:@pi/info" } });
    fireEvent.click(screen.getByRole("button", { name: "安装" }));
    expect(onInstallPackage).toHaveBeenCalledTimes(1);
    expect(onInstallPackage.mock.calls[0]?.[0]).toBe("npm:@pi/info");
  });

  it("removes a configured package", () => {
    const onRemovePackage = vi.fn<(source: string, scope: string) => void>();
    render(<SettingsPackagesPanel {...base} packagesResponse={response([pkg()])} onRemovePackage={onRemovePackage} />);
    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    expect(onRemovePackage).toHaveBeenCalledTimes(1);
    expect(onRemovePackage.mock.calls[0]?.[0]).toBe("npm:@pi/git");
    expect(onRemovePackage.mock.calls[0]?.[1]).toBe("user");
  });
});
