import { type JSX, useState } from "react";
import clsx from "clsx";
import type { PiPackageInfo, PiPackageInstallableSuggestion, PiPackageScope, PiPackagesResponse } from "@shared/apiTypes";
import {
  canUpdateAllPiPackages,
  canUpdatePiPackage,
  isPiPackageOperationPending,
  normalizePiPackageSource,
  type PiPackageOperationState,
  type PiPackageTargetContext,
} from "@client/components/settings/piPackageSettings";
import styles from "./SettingsPackagesPanel.module.css";

// SettingsPackagesPanel — React port of the Lit settings-packages-panel.
// Installable-known-package one-click suggestions + a free-form install form +
// the configured-package list with per-package update/remove and an update-all
// control. The enablement predicates come from the pure piPackageSettings
// module; the user-facing labels/validation are localized here (Chinese) so the
// shared logic module stays untouched. The parent (useSettings) owns the
// mutations and network-error presentation, so the local component state is just
// the install input + its client-side validation message.

// Localized label helpers — Chinese equivalents of the piPackageSettings label
// functions, kept panel-local so the shared logic module is reused unchanged.
function targetLabelText(target: PiPackageTargetContext): string {
  return target.kind === "local" ? `${target.name}（本地网关）` : `${target.name}（远程机器）`;
}

function sourceValidationMessage(source: string): string | undefined {
  if (normalizePiPackageSource(source) !== "") return undefined;
  return "请输入 Pi 接受的 Pi 软件包来源，例如 npm:@scope/package、git/URL 来源或本地路径。";
}

function scopeLabel(packageInfo: Pick<PiPackageInfo, "scope">): string {
  return packageInfo.scope === "project" ? "项目范围" : "用户范围";
}

function filteredLabel(packageInfo: Pick<PiPackageInfo, "filtered">): string {
  return packageInfo.filtered ? "已被当前 Pi 软件包设置过滤" : "在此 PI WEB 进程中可用";
}

function installedPathLabel(packageInfo: Pick<PiPackageInfo, "installedPath">): string {
  return packageInfo.installedPath ?? "Pi 未报告安装路径";
}

function updateDisabledReason(packageInfo: Pick<PiPackageInfo, "scope">): string | undefined {
  if (canUpdatePiPackage(packageInfo)) return undefined;
  return "项目范围的 Pi 软件包在此列出以便查看，但 PI WEB 只会在此视图中安全地更新用户范围的 Pi 软件包。";
}

function updateAllDisabledReason(packages: readonly Pick<PiPackageInfo, "scope">[]): string | undefined {
  if (packages.length === 0) return "尚未配置任何 Pi 软件包。";
  if (canUpdateAllPiPackages(packages)) return undefined;
  return "当列出项目范围的 Pi 软件包时，“全部更新”被禁用；请单独更新用户范围的软件包。";
}

export interface SettingsPackagesPanelProps {
  packagesResponse: PiPackagesResponse | undefined;
  loading: boolean;
  operation: PiPackageOperationState | undefined;
  targetMachine: PiPackageTargetContext;
  error: string;
  operationMessage: string;
  onReload: () => void;
  onInstallPackage: (source: string) => void | Promise<void>;
  onRemovePackage: (source: string, scope: PiPackageScope) => void | Promise<void>;
  onUpdatePackage: (source?: string) => void | Promise<void>;
}

export function SettingsPackagesPanel(props: SettingsPackagesPanelProps): JSX.Element {
  const { packagesResponse, loading, operation, targetMachine } = props;
  const [installSource, setInstallSource] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const packages = packagesResponse?.packages ?? [];
  const targetLabel = targetLabelText(targetMachine);
  const showPackageControls = packagesResponse !== undefined;
  const isOperating = operation !== undefined;

  const onInstallSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const message = sourceValidationMessage(installSource);
    if (message !== undefined) {
      setValidationMessage(message);
      return;
    }
    const source = normalizePiPackageSource(installSource);
    try {
      await props.onInstallPackage(source);
      setInstallSource("");
      setValidationMessage("");
    } catch {
      // The parent owns network error presentation so package errors are consistent across Settings.
    }
  };

  const installKnownPackage = async (source: string): Promise<void> => {
    try {
      await props.onInstallPackage(source);
    } catch {
      // Parent-owned error presentation.
    }
  };

  const removePackage = async (packageInfo: PiPackageInfo): Promise<void> => {
    try {
      await props.onRemovePackage(packageInfo.source, packageInfo.scope);
    } catch {
      // Parent-owned error presentation.
    }
  };

  const updatePackage = async (source?: string): Promise<void> => {
    try {
      await props.onUpdatePackage(source);
    } catch {
      // Parent-owned error presentation.
    }
  };

  return (
    <section className={styles.panel} aria-label="Pi 软件包">
      <header className={styles.panelHeader}>
        <div className={styles.headingCopy}>
          <h2>Pi 软件包</h2>
          <p>
            正在管理 <strong>{targetLabel}</strong> 上的 Pi 软件包。在选定的机器上安装、移除和更新由 Pi 管理的软件包。Pi 软件包可提供扩展、技能、提示模板、主题、上下文/系统提示文件以及 PI WEB 浏览器插件。
          </p>
        </div>
        <button type="button" className={styles.secondary} disabled={loading || isOperating} onClick={props.onReload} title={`从 ${targetLabel} 重新加载 Pi 软件包`}>
          重新加载
        </button>
      </header>

      {props.error !== "" && <div className={clsx(styles.notice, styles.error)} role="alert">{props.error}</div>}
      {props.operationMessage !== "" && <div className={clsx(styles.notice, styles.success)} role="status">{props.operationMessage}</div>}
      {showPackageControls && (
        <div className={clsx(styles.notice, styles.security)}>
          <strong>可信代码警告：</strong> Pi 软件包和 PI WEB 插件可以以你的用户权限运行。请仅安装来自你信任来源的软件包并启用其插件。
        </div>
      )}

      {packagesResponse === undefined ? (
        <div className={styles.loadingCard}>
          {loading ? `正在从 ${targetLabel} 加载 Pi 软件包…` : `无法获取 ${targetLabel} 的 Pi 软件包列表。请使用“重新加载”重试。`}
        </div>
      ) : (
        <>
          {renderInstallableKnownPackages(packagesResponse, targetLabel, isOperating, operation, installKnownPackage)}

          <form className={styles.installCard} onSubmit={(event) => void onInstallSubmit(event)}>
            <label htmlFor="package-source">Pi 软件包来源</label>
            <div className={styles.installRow}>
              <input
                id="package-source"
                className={styles.input}
                value={installSource}
                disabled={isOperating}
                placeholder="npm:@scope/package、git URL 或本地路径"
                onChange={(event) => {
                  setInstallSource(event.target.value);
                  setValidationMessage("");
                }}
              />
              <button type="submit" className={styles.button} title="安装此 Pi 软件包" disabled={isOperating}>
                {isPiPackageOperationPending(operation, "install") ? "安装中…" : "安装"}
              </button>
            </div>
            {validationMessage !== "" && <div className={styles.fieldError}>{validationMessage}</div>}
            <small>
              安装在 {targetLabel} 上运行，并使用 Pi 的默认软件包位置，等同于 <code>pi install &lt;source&gt;</code>。PI WEB 不会要求你选择安装位置。
            </small>
          </form>

          {renderPackageList(packages, targetLabel, loading, isOperating, operation, updatePackage, removePackage)}
        </>
      )}
    </section>
  );
}

function renderInstallableKnownPackages(
  response: PiPackagesResponse,
  targetLabel: string,
  isOperating: boolean,
  operation: PiPackageOperationState | undefined,
  installKnownPackage: (source: string) => void | Promise<void>,
): JSX.Element | null {
  const suggestions = response.installableKnownPackages ?? [];
  if (suggestions.length === 0) return null;
  return (
    <section className={styles.knownPackageSection} aria-label="可用的已知 Pi 软件包">
      <h3>可用软件包</h3>
      <p>
        PI WEB 附带了这些软件包，你可以在 {targetLabel} 上一键安装它们，无需输入路径——包括你之前移除过的软件包。
      </p>
      <div className={styles.knownPackageList}>
        {suggestions.map((suggestion) => renderInstallableKnownPackage(suggestion, isOperating, operation, installKnownPackage))}
      </div>
    </section>
  );
}

function renderInstallableKnownPackage(
  suggestion: PiPackageInstallableSuggestion,
  isOperating: boolean,
  operation: PiPackageOperationState | undefined,
  installKnownPackage: (source: string) => void | Promise<void>,
): JSX.Element {
  const installing = isPiPackageOperationPending(operation, "install", suggestion.source);
  return (
    <article key={suggestion.source} className={styles.knownPackageCard}>
      <div className={styles.packageMain}>
        <strong>{suggestion.label}</strong>
        <small>{suggestion.description}</small>
      </div>
      <button type="button" className={styles.button} title={`安装 ${suggestion.label}`} disabled={isOperating} onClick={() => void installKnownPackage(suggestion.source)}>
        {installing ? "安装中…" : "安装"}
      </button>
    </article>
  );
}

function renderPackageList(
  packages: PiPackageInfo[],
  targetLabel: string,
  loading: boolean,
  isOperating: boolean,
  operation: PiPackageOperationState | undefined,
  updatePackage: (source?: string) => void | Promise<void>,
  removePackage: (packageInfo: PiPackageInfo) => void | Promise<void>,
): JSX.Element {
  const updateAllReason = updateAllDisabledReason(packages);
  const showUpdateAllReason = updateAllReason !== undefined && packages.length > 0;
  const updateAllTitle = updateAllReason ?? "更新所有用户范围的 Pi 软件包";
  return (
    <section className={styles.packageSection} aria-label="已配置的 Pi 软件包">
      <div className={styles.packageToolbar}>
        <div>
          <h3>已配置的 Pi 软件包</h3>
          <p>此列表来自 {targetLabel} 上 Pi 软件包管理器的设置。</p>
        </div>
        <button
          type="button"
          className={clsx(styles.button, styles.secondary)}
          title={updateAllTitle}
          disabled={isOperating || updateAllReason !== undefined}
          onClick={() => void updatePackage()}
        >
          {isPiPackageOperationPending(operation, "update-all") ? "更新中…" : "全部更新"}
        </button>
      </div>
      {showUpdateAllReason && <div className={styles.actionNote}>{updateAllReason}</div>}
      {loading && packages.length > 0 && <div className={styles.actionNote}>正在从 {targetLabel} 刷新 Pi 软件包…</div>}
      {renderPackageListContent(packages, targetLabel, loading, isOperating, operation, updatePackage, removePackage)}
    </section>
  );
}

function renderPackageListContent(
  packages: PiPackageInfo[],
  targetLabel: string,
  loading: boolean,
  isOperating: boolean,
  operation: PiPackageOperationState | undefined,
  updatePackage: (source?: string) => void | Promise<void>,
  removePackage: (packageInfo: PiPackageInfo) => void | Promise<void>,
): JSX.Element {
  if (loading && packages.length === 0) return <div className={styles.loadingCard}>正在从 {targetLabel} 加载 Pi 软件包…</div>;
  if (packages.length === 0) return <div className={styles.loadingCard}>在 {targetLabel} 上的 Pi 设置中尚未配置任何 Pi 软件包。</div>;
  return (
    <div className={styles.packageList}>
      {packages.map((packageInfo) => renderPackage(packageInfo, isOperating, operation, updatePackage, removePackage))}
    </div>
  );
}

function renderPackage(
  packageInfo: PiPackageInfo,
  isOperating: boolean,
  operation: PiPackageOperationState | undefined,
  updatePackage: (source?: string) => void | Promise<void>,
  removePackage: (packageInfo: PiPackageInfo) => void | Promise<void>,
): JSX.Element {
  const updateReason = updateDisabledReason(packageInfo);
  const updating = isPiPackageOperationPending(operation, "update", packageInfo.source);
  const removing = isPiPackageOperationPending(operation, "remove", packageInfo.source);
  return (
    <article key={`${packageInfo.scope}:${packageInfo.source}`} className={clsx(styles.packageCard, packageInfo.filtered && styles.filtered)}>
      <div className={styles.packageMain}>
        <strong>{packageInfo.source}</strong>
        <small>
          {scopeLabel(packageInfo)} · {filteredLabel(packageInfo)}
        </small>
        <small>
          安装路径：<code>{installedPathLabel(packageInfo)}</code>
        </small>
        {updateReason !== undefined && <small className={styles.actionNote}>{updateReason}</small>}
      </div>
      <div className={styles.packageActions}>
        <button
          type="button"
          className={clsx(styles.button, styles.secondary)}
          title={updateReason ?? "更新此 Pi 软件包"}
          disabled={isOperating || updateReason !== undefined}
          onClick={() => void updatePackage(packageInfo.source)}
        >
          {updating ? "更新中…" : "更新"}
        </button>
        <button type="button" className={clsx(styles.button, styles.danger)} title="移除此 Pi 软件包" disabled={isOperating} onClick={() => void removePackage(packageInfo)}>
          {removing ? "移除中…" : "移除"}
        </button>
      </div>
    </article>
  );
}
