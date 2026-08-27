import { type JSX, Fragment } from "react";
import clsx from "clsx";
import type { PiWebConfigResponse, PiWebPluginInfo, PiWebPluginsResponse } from "@shared/apiTypes";
import { PI_WEB_PLUGIN_RECOVERY_COMMANDS } from "@shared/pluginRecoveryCommands";
import styles from "./SettingsPluginsPanel.module.css";

// SettingsPluginsPanel — React port of the Lit settings-plugins-panel. Lists
// discovered/configured PI WEB plugins with a desired-enable/disable toggle,
// surfaces the sessiond runtime diagnostics (safe-mode, restart-required,
// discovery/conflict diagnostics) as notices, and prints the offline recovery
// commands. Reuses the pure settingsPluginRows/serverState* helpers (copied
// verbatim from the Lit panel — the same shape the legacy dialog fed the panel).
// The toggle is disabled while saving, when config failed to load, or when the
// row is a not-editable active-snapshot-only entry.

export type SettingsPluginRow = PiWebPluginInfo & { configOnly: boolean; editable: boolean };

export interface SettingsPluginsPanelProps {
  pluginsResponse: PiWebPluginsResponse | undefined;
  configResponse: PiWebConfigResponse | undefined;
  loading: boolean;
  saving: boolean;
  recoveryCommandsSupported: boolean;
  error: string;
  savedMessage: string;
  targetLabel: string;
  onReload: () => void;
  onTogglePlugin: (pluginId: string, enabled: boolean) => void | Promise<void>;
}

interface PanelNotice {
  key: string;
  tone: "error" | "warning" | "availability" | "security" | "success";
  title?: string;
  content: JSX.Element | string;
}

export function SettingsPluginsPanel(props: SettingsPluginsPanelProps): JSX.Element {
  const { pluginsResponse, configResponse, loading } = props;
  const plugins = settingsPluginRows(pluginsResponse, configResponse);
  const hasPluginResponse = pluginsResponse !== undefined;
  const showTrustedCodeWarning = plugins.length > 0;
  const notices = panelNotices(props, showTrustedCodeWarning);

  return (
    <section className={styles.panel} aria-label="PI WEB 插件">
      <header className={styles.panelHeader}>
        <div className={styles.headingCopy}>
          <h2>PI WEB 插件</h2>
          <p>
            在 <strong>{props.targetLabel}</strong> 上，将期望的插件配置与活动的会话守护进程启动快照进行对比。这与安装 Pi 软件包是相互独立的。
          </p>
        </div>
        <button type="button" className={styles.secondary} disabled={loading} onClick={props.onReload} title={`从 ${props.targetLabel} 重新加载 PI WEB 插件`}>
          重新加载
        </button>
      </header>

      {notices.map((notice) => (
        <div key={notice.key} className={clsx(styles.notice, toneClass(notice.tone))} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.title !== undefined && <strong className={styles.noticeTitle}>{notice.title}</strong>}
          <span>{notice.content}</span>
        </div>
      ))}

      {renderPanelContent(props, plugins, hasPluginResponse)}
    </section>
  );
}

function renderPanelContent(props: SettingsPluginsPanelProps, plugins: SettingsPluginRow[], hasPluginResponse: boolean): JSX.Element {
  const { loading, targetLabel } = props;
  if (!hasPluginResponse && plugins.length === 0) {
    return (
      <>
        <div className={styles.loadingCard}>
          {loading ? "正在加载 PI WEB 插件…" : `无法获取 ${targetLabel} 的 PI WEB 插件列表。请使用“重新加载”重试。`}
        </div>
        {renderRecoveryCommands(props)}
      </>
    );
  }
  if (plugins.length === 0) {
    return (
      <>
        <div className={styles.loadingCard}>在 {targetLabel} 上未发现或激活任何 PI WEB 插件。</div>
        {renderRecoveryCommands(props)}
      </>
    );
  }
  return (
    <>
      <div className={styles.pluginNote}>
        {targetLabel} 上的配置键：<code>plugins</code>。仅浏览器的更改会在标签页重新加载后生效；服务端支持的更改遵循会话守护进程的启动快照，可能需要手动重启。
      </div>
      <div className={styles.pluginList}>{plugins.map((plugin) => renderPlugin(props, plugin))}</div>
      {renderRecoveryCommands(props)}
    </>
  );
}

function renderPlugin(props: SettingsPluginsPanelProps, plugin: SettingsPluginRow): JSX.Element {
  const { configResponse, saving } = props;
  const configured = configResponse?.config.plugins?.[plugin.id];
  const configuredState =
    !plugin.discovered && configured === undefined
      ? "期望的软件包/配置缺失"
      : configured?.enabled === false
        ? "配置已禁用"
        : configured?.enabled === true
          ? "配置已启用"
          : "默认启用";
  return (
    <article key={plugin.id} className={clsx(styles.pluginCard, !plugin.enabled && styles.disabled)}>
      <div className={styles.pluginMain}>
        <strong>{plugin.id}</strong>
        <small>
          {plugin.configOnly
            ? "仅配置 · 未发现软件包"
            : `${plugin.source} · ${plugin.scope}${plugin.machineSpecific ? " · 特定于机器" : ""}${plugin.discovered ? "" : " · 仅活动快照"}`}
        </small>
        <small>{configuredState}</small>
        {renderPluginStatuses(plugin)}
        {plugin.server?.message !== undefined && <small className={styles.diagnostic}>{plugin.server.message}</small>}
        {plugin.server?.health?.message !== undefined && <small className={styles.diagnostic}>健康状况：{plugin.server.health.message}</small>}
        {plugin.server !== undefined && (
          <small className={styles.command}>
            离线禁用：<code>{plugin.server.disableCommand}</code>
          </small>
        )}
      </div>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={plugin.enabled}
          disabled={saving || configResponse === undefined || !plugin.editable}
          onChange={(event) => void props.onTogglePlugin(plugin.id, event.target.checked)}
        />
        <span>{plugin.enabled ? "期望启用" : "期望禁用"}</span>
      </label>
    </article>
  );
}

function renderPluginStatuses(plugin: SettingsPluginRow): JSX.Element {
  const server = plugin.server;
  return (
    <div className={styles.statusList} aria-label={`${plugin.id} 插件状态`}>
      {server === undefined ? (
        <span className={clsx(styles.status, styles.neutral)}>{plugin.configOnly ? "仅配置" : "仅浏览器"}</span>
      ) : (
        <span className={clsx(styles.status, statusTone(serverStateTone(server.state)))}>{serverStateLabel(server.state)}</span>
      )}
      {plugin.conflict && <span className={clsx(styles.status, styles.error)}>冲突</span>}
      {server?.staleRevision === true && <span className={clsx(styles.status, styles.warning)}>版本过时</span>}
      {server?.restartRequired === true && <span className={clsx(styles.status, styles.warning)}>需要重启</span>}
      {server?.health !== undefined && (
        <span className={clsx(styles.status, statusTone(healthTone(server.health.status)))}>健康状况 {healthStatusLabel(server.health.status)}</span>
      )}
    </div>
  );
}

function renderRecoveryCommands(props: SettingsPluginsPanelProps): JSX.Element | null {
  const runtime = props.pluginsResponse?.serverRuntime;
  const responseRecovery = runtime?.status === "incompatible" && !props.recoveryCommandsSupported ? undefined : runtime?.recovery;
  const recovery = responseRecovery ?? (props.recoveryCommandsSupported ? PI_WEB_PLUGIN_RECOVERY_COMMANDS : undefined);
  if (recovery === undefined) return null;
  return (
    <aside className={styles.recovery} aria-label="离线服务端插件恢复命令">
      <strong>{props.targetLabel} 上的离线恢复</strong>
      <small>这些命令在不联系会话守护进程或导入插件的情况下编辑配置。它们绝不会包含机器凭据。</small>
      <code>{recovery.showSafeStart}</code>
      <code>{recovery.bundledOnly}</code>
      <code>{recovery.noServerPlugins}</code>
      <code>{recovery.clearSafeStart}</code>
    </aside>
  );
}

function panelNotices(props: SettingsPluginsPanelProps, showTrustedCodeWarning: boolean): PanelNotice[] {
  const { error, savedMessage, pluginsResponse, configResponse, loading } = props;
  const notices: PanelNotice[] = [];
  if (error !== "") notices.push({ key: "error", tone: "error", content: error });
  if (showTrustedCodeWarning && configResponse === undefined && !loading && error === "") {
    notices.push({
      key: "config-unavailable",
      tone: "availability",
      content: "配置不可用。请在更改插件启用状态之前重新加载以重试。",
    });
  }
  if (savedMessage !== "") notices.push({ key: "saved", tone: "success", content: savedNotice(props) });

  const runtime = pluginsResponse?.serverRuntime;
  if (runtime?.status === "unavailable") {
    notices.push({
      key: "runtime-unavailable",
      tone: "availability",
      title: "活动的服务端插件状态不可用",
      content: `期望的配置仍可编辑，但 PI WEB 无法验证会话守护进程的快照。${runtime.message ?? "请重启或重新连接会话守护进程，然后重新加载。"}`,
    });
  } else if (runtime?.status === "incompatible") {
    notices.push({
      key: "runtime-incompatible",
      tone: "error",
      title: "插件生命周期版本不匹配",
      content: `${runtime.message ?? "web 进程与会话守护进程不支持相同的插件生命周期协议。"} 请先更新并重启两个组件，然后再加载服务端支持的浏览器插件。`,
    });
  }
  if (runtime?.safeStart !== undefined) {
    notices.push({
      key: "safe-mode",
      tone: "warning",
      title: "服务端插件安全模式已激活",
      content:
        runtime.safeStart === "bundled-only" ? (
          <>
            仅导入了捆绑的服务端插件。使用 <code>{runtime.recovery.clearSafeStart}</code> 清除安全模式。
          </>
        ) : (
          <>
            未导入任何服务端插件；内核文件夹工作区仍然可用。使用{" "}
            <code>{runtime.recovery.clearSafeStart}</code> 清除安全模式。
          </>
        ),
    });
  }
  if (runtime?.desiredSafeStart !== undefined && runtime.desiredSafeStart !== (runtime.safeStart ?? "off")) {
    notices.push({
      key: "safe-mode-pending",
      tone: "warning",
      title: "安全模式重启待处理",
      content:
        runtime.desiredSafeStart === "off"
          ? "安全启动已在离线配置中清除，但在会话守护进程重启之前仍保持激活。"
          : `离线配置请求 ${runtime.desiredSafeStart} 安全启动。它将在下次会话守护进程重启的插件导入之前生效。`,
    });
  }
  if (runtime?.restartRequired === true) {
    notices.push({
      key: "restart-required",
      tone: "warning",
      title: "需要重启会话守护进程",
      content:
        "期望的插件配置或软件包版本与会话守护进程的活动启动快照不同。重启会话守护进程可能会中断活动的会话。",
    });
  }
  for (const [index, diagnostic] of (pluginsResponse?.diagnostics ?? []).entries()) {
    notices.push({
      key: `diagnostic-${String(index)}`,
      tone: diagnostic.kind === "conflict" ? "error" : "warning",
      title: diagnostic.kind === "conflict" ? "插件 id 冲突" : "插件发现诊断",
      content: `${diagnostic.snapshot === "active" ? "活动快照" : "期望目录"}：${diagnostic.message}`,
    });
  }
  if (showTrustedCodeWarning) {
    notices.push({
      key: "trusted-code",
      tone: "security",
      content: (
        <Fragment>
          <strong>可信代码警告：</strong> PI WEB 插件和 Pi 软件包可以以你的用户权限运行。请仅启用来自你信任来源的插件。
        </Fragment>
      ),
    });
  }
  return notices;
}

function savedNotice(props: SettingsPluginsPanelProps): string {
  const runtime = props.pluginsResponse?.serverRuntime;
  if (runtime?.status !== "available" || runtime.restartRequired) {
    return `${props.savedMessage} 重启会话守护进程以应用服务端插件的更改；仅浏览器的更改会在重新加载此标签页后生效。`;
  }
  return `${props.savedMessage} 重新加载浏览器标签页以应用仅浏览器的插件更改。`;
}

// --- Pure helpers copied verbatim from the Lit settings-plugins-panel. ---

export function settingsPluginRows(
  response: PiWebPluginsResponse | undefined,
  config: PiWebConfigResponse | undefined,
): SettingsPluginRow[] {
  const configuredPlugins = config?.config.plugins ?? {};
  const rows = (response?.plugins ?? []).map((plugin): SettingsPluginRow => {
    const configured = configuredPlugins[plugin.id];
    const enabled = configured?.enabled ?? plugin.enabled;
    return {
      ...plugin,
      enabled,
      configOnly: false,
      editable: plugin.discovered || configured !== undefined,
    };
  });
  const knownIds = new Set(rows.map(({ id }) => id));
  for (const [id, configured] of Object.entries(configuredPlugins)) {
    if (knownIds.has(id)) continue;
    rows.push({
      id,
      source: "config",
      scope: "local",
      machineSpecific: false,
      enabled: configured.enabled !== false,
      discovered: false,
      conflict: false,
      configOnly: true,
      editable: true,
    });
  }
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

type StatusTone = "success" | "warning" | "error" | "neutral";

function serverStateLabel(state: NonNullable<PiWebPluginInfo["server"]>["state"]): string {
  switch (state) {
    case "active":
      return "活动";
    case "failed":
      return "失败";
    case "incompatible":
      return "不兼容";
    case "disabled":
      return "已禁用";
    case "missing":
      return "未激活";
    case "unknown":
      return "活动状态不可用";
  }
}

function healthStatusLabel(status: NonNullable<NonNullable<PiWebPluginInfo["server"]>["health"]>["status"]): string {
  switch (status) {
    case "healthy":
      return "健康";
    case "degraded":
      return "降级";
    case "unhealthy":
      return "不健康";
  }
}

function serverStateTone(state: NonNullable<PiWebPluginInfo["server"]>["state"]): StatusTone {
  switch (state) {
    case "active":
      return "success";
    case "disabled":
    case "missing":
      return "warning";
    case "failed":
    case "incompatible":
      return "error";
    case "unknown":
      return "neutral";
  }
}

function healthTone(status: NonNullable<NonNullable<PiWebPluginInfo["server"]>["health"]>["status"]): StatusTone {
  switch (status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "unhealthy":
      return "error";
  }
}

function statusTone(tone: StatusTone): string | undefined {
  switch (tone) {
    case "success":
      return styles.success;
    case "warning":
      return styles.warning;
    case "error":
      return styles.error;
    case "neutral":
      return styles.neutral;
  }
}

function toneClass(tone: PanelNotice["tone"]): string | undefined {
  switch (tone) {
    case "error":
      return styles.error;
    case "success":
      return styles.success;
    case "security":
      return styles.security;
    case "warning":
    case "availability":
      return styles.warning;
  }
}
