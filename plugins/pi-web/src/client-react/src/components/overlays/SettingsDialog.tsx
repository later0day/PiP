import type { JSX } from "react";
import { ModalSurface } from "../../primitives";
import type { AppAction } from "@client/actions";
import type { SettingsSection } from "@client/settingsRoute";
import { useSettings } from "../../state/useSettings";
import { SettingsGeneralPanel } from "../settings/SettingsGeneralPanel";
import { SettingsSessiondPanel } from "../settings/SettingsSessiondPanel";
import { SettingsShortcutsPanel } from "../settings/SettingsShortcutsPanel";
import { SettingsPluginsPanel } from "../settings/SettingsPluginsPanel";
import { SettingsPackagesPanel } from "../settings/SettingsPackagesPanel";
import styles from "./SettingsDialog.module.css";

// SettingsDialog — React port of the Lit settings-dialog frame: a 5-section nav
// (general/sessiond/packages/plugins/shortcuts) on the shared ModalSurface. The
// General section is fully implemented via useSettings (gateway + selected-
// machine file access config), reusing the pure settings* logic modules; the
// other four sections render a "coming soon" placeholder until a later
// increment ports their panels. Section navigation is driven from the URL
// (?settings=<section>) by the caller through onNavigate.

interface NavItem {
  section: SettingsSection;
  label: string;
  detail: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { section: "general", label: "常规", detail: "网关 + 选中机器" },
  { section: "sessiond", label: "会话守护进程", detail: "选中机器" },
  { section: "packages", label: "Pi 软件包", detail: "选中机器" },
  { section: "plugins", label: "PI WEB 插件", detail: "选中机器" },
  { section: "shortcuts", label: "键盘", detail: "网关快捷键" },
];

export interface SettingsDialogProps {
  section: SettingsSection;
  actions: AppAction[];
  onNavigate: (section: SettingsSection) => void;
  onClose: () => void;
}

export function SettingsDialog({ section, actions, onNavigate, onClose }: SettingsDialogProps): JSX.Element {
  const settings = useSettings();

  return (
    <ModalSurface onClose={onClose} busy={settings.saving} label="PI WEB 设置" className={styles.surface}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>设置</span>
            <h1>PI WEB</h1>
          </div>
          <button type="button" className={styles.close} onClick={onClose} title="关闭设置" aria-label="关闭设置">
            ×
          </button>
        </header>
        <div className={styles.body}>
          <nav className={styles.nav} aria-label="设置分区">
            {NAV_ITEMS.map((item) => {
              const selected = section === item.section;
              return (
                <button
                  key={item.section}
                  type="button"
                  className={selected ? styles.navSelected : styles.navButton}
                  aria-current={selected ? "page" : "false"}
                  onClick={() => { onNavigate(item.section); }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              );
            })}
          </nav>
          <main className={styles.content}>
            {section === "general" ? (
              <SettingsGeneralPanel
                configResponse={settings.configResponse}
                machineConfigResponse={settings.accessConfigResponse}
                loading={settings.loading}
                machineLoading={settings.accessLoading}
                saving={settings.saving}
                error={settings.error}
                machineError={settings.accessError}
                savedMessage={settings.savedMessage}
                targetLabel={settings.targetLabel}
                onReload={() => void settings.reloadConfig()}
                onReloadMachine={() => void settings.reloadAccessConfig()}
                onSave={settings.saveConfig}
                onSaveMachineConfig={settings.saveMachineAccessConfig}
              />
            ) : section === "sessiond" ? (
              <SettingsSessiondPanel
                configResponse={settings.sessiondConfigResponse}
                loading={settings.sessiondLoading}
                saving={settings.saving}
                error={settings.sessiondError}
                savedMessage={settings.savedMessage}
                targetLabel={settings.targetLabel}
                onReload={() => void settings.reloadSessiondConfig()}
                onSave={settings.saveSessiondConfig}
              />
            ) : section === "shortcuts" ? (
              <SettingsShortcutsPanel
                actions={actions}
                configResponse={settings.configResponse}
                loading={settings.loading}
                saving={settings.saving}
                error={settings.error}
                savedMessage={settings.savedMessage}
                onReload={() => void settings.reloadConfig()}
                onSave={settings.saveConfig}
              />
            ) : section === "plugins" ? (
              <SettingsPluginsPanel
                pluginsResponse={settings.pluginsResponse}
                configResponse={settings.pluginConfigResponse}
                loading={settings.pluginLoading}
                saving={settings.saving}
                recoveryCommandsSupported={settings.recoveryCommandsSupported}
                error={settings.pluginError}
                savedMessage={settings.savedMessage}
                targetLabel={settings.targetLabel}
                onReload={() => void settings.reloadPlugins()}
                onTogglePlugin={settings.togglePlugin}
              />
            ) : (
              <SettingsPackagesPanel
                packagesResponse={settings.packagesResponse}
                loading={settings.packageLoading}
                operation={settings.packageOperation}
                targetMachine={settings.packageTarget}
                error={settings.packageError}
                operationMessage={settings.packageMessage}
                onReload={() => void settings.reloadPackages()}
                onInstallPackage={settings.installPiPackage}
                onRemovePackage={settings.removePiPackage}
                onUpdatePackage={settings.updatePiPackage}
              />
            )}
          </main>
        </div>
      </div>
    </ModalSurface>
  );
}
