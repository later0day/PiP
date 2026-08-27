import clsx from "clsx";
import { type JSX, useEffect, useState } from "react";
import { DEFAULT_WORKSPACE_UPLOADS_FOLDER } from "@api/workspaceUploads";
import type { PiWebConfigEnvOverrides, PiWebConfigResponse, PiWebConfigValues } from "@shared/apiTypes";
import {
  emptyGatewayServerConfigDraft,
  emptyMachineAccessConfigDraft,
  gatewayServerConfigFromDraft,
  gatewayServerDraftFromConfig,
  machineAccessConfigPatchFromDraft,
  machineAccessDraftFromConfig,
  type GatewayServerConfigDraft,
  type MachineAccessConfigDraft,
} from "@client/components/settings/settingsConfigDraft";
import styles from "./SettingsPanels.module.css";

// SettingsGeneralPanel — React port of the Lit settings-general-panel. Two
// cards: gateway server (host/port/allowed-hosts, edits the local gateway) and
// selected-machine file access + uploads (external roots + default upload
// folder, edits the target machine). All draft <-> config conversion + parse
// validation reuses the pure settingsConfigDraft module unchanged; the drafts
// re-derive whenever their config response identity changes (mirrors the Lit
// willUpdate reseed).

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SettingsGeneralPanelProps {
  configResponse: PiWebConfigResponse | undefined;
  machineConfigResponse: PiWebConfigResponse | undefined;
  loading: boolean;
  machineLoading: boolean;
  saving: boolean;
  error: string;
  machineError: string;
  savedMessage: string;
  targetLabel: string;
  onReload: () => void;
  onReloadMachine: () => void;
  onSave: (config: PiWebConfigValues) => void | Promise<void>;
  onSaveMachineConfig: (config: PiWebConfigValues) => void | Promise<void>;
}

export function SettingsGeneralPanel(props: SettingsGeneralPanelProps): JSX.Element {
  const { configResponse, machineConfigResponse, loading, machineLoading, saving } = props;

  const [gatewayDraft, setGatewayDraft] = useState<GatewayServerConfigDraft>(emptyGatewayServerConfigDraft);
  const [machineDraft, setMachineDraft] = useState<MachineAccessConfigDraft>(emptyMachineAccessConfigDraft);
  const [gatewayLocalError, setGatewayLocalError] = useState("");
  const [machineLocalError, setMachineLocalError] = useState("");

  // Reseed the drafts when a fresh config response arrives (identity change),
  // matching the Lit willUpdate(changed.has(...)) behavior.
  useEffect(() => {
    if (configResponse !== undefined) {
      setGatewayDraft(gatewayServerDraftFromConfig(configResponse.config));
      setGatewayLocalError("");
    }
  }, [configResponse]);

  useEffect(() => {
    if (machineConfigResponse !== undefined) {
      setMachineDraft(machineAccessDraftFromConfig(machineConfigResponse.config));
      setMachineLocalError("");
    }
  }, [machineConfigResponse]);

  const updateGateway = (patch: Partial<GatewayServerConfigDraft>): void => {
    setGatewayDraft((current) => ({ ...current, ...patch }));
    setGatewayLocalError("");
  };
  const updateMachine = (patch: Partial<MachineAccessConfigDraft>): void => {
    setMachineDraft((current) => ({ ...current, ...patch }));
    setMachineLocalError("");
  };

  const saveGateway = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setGatewayLocalError("");
    try {
      await props.onSave(gatewayServerConfigFromDraft(gatewayDraft, configResponse?.config ?? {}));
    } catch (err) {
      setGatewayLocalError(errorMessage(err));
    }
  };

  const saveMachine = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setMachineLocalError("");
    try {
      await props.onSaveMachineConfig(machineAccessConfigPatchFromDraft(machineDraft));
    } catch (err) {
      setMachineLocalError(errorMessage(err));
    }
  };

  const gatewayError = gatewayLocalError || props.error;
  const machineErr = machineLocalError || props.machineError;

  const renderOverrideBadge = (key: keyof PiWebConfigEnvOverrides): JSX.Element | null =>
    configResponse?.envOverrides[key] === true ? <span className={styles.overrideBadge}>环境变量覆盖</span> : null;

  return (
    <section className={styles.panel} aria-label="常规配置">
      <header className={styles.panelHeader}>
        <div className={styles.headingCopy}>
          <h2>常规配置</h2>
          <p>网关服务器字段编辑此本地网关。文件访问和上传默认值编辑{props.targetLabel}。</p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          disabled={loading || machineLoading}
          onClick={() => {
            props.onReload();
            props.onReloadMachine();
          }}
        >
          重新加载
        </button>
      </header>

      {gatewayError !== "" && <div className={clsx(styles.notice, styles.error)} role="alert"><strong className={styles.noticeTitle}>网关服务器</strong><div>{gatewayError}</div></div>}
      {props.savedMessage !== "" && <div className={clsx(styles.notice, styles.success)} role="status">{props.savedMessage}</div>}

      <div className={styles.sections}>
        {/* Gateway server */}
        <section className={styles.card} aria-label="网关服务器设置">
          <div className={styles.cardHeading}>
            <h3>网关服务器</h3>
            <p>主机、端口和允许的主机保存在网关配置中。地址更改需要重启 web 服务后，运行中的服务器才会绑定到新地址。</p>
          </div>
          {configResponse === undefined && loading ? (
            <div className={styles.loadingCard}>正在加载网关配置…</div>
          ) : (
            <>
              <div className={styles.configPathCard}>
                <span>网关配置文件</span>
                <code>{configResponse?.path ?? "未知"}</code>
                <small>{configResponse?.exists === true ? "已有文件" : "此文件将在保存时创建"}</small>
              </div>
              <form className={styles.form} onSubmit={(event) => void saveGateway(event)}>
                <label className={styles.field}>
                  <span className={styles.fieldHeading}><span>主机</span>{renderOverrideBadge("host")}</span>
                  <input
                    value={gatewayDraft.host}
                    placeholder="127.0.0.1"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => { updateGateway({ host: event.target.value }); }}
                  />
                  <small>web 服务器应绑定的地址。留空则使用 PI WEB 的默认值。</small>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldHeading}><span>端口</span>{renderOverrideBadge("port")}</span>
                  <input
                    value={gatewayDraft.port}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="8504"
                    autoComplete="off"
                    onChange={(event) => { updateGateway({ port: event.target.value }); }}
                  />
                  <small>1 到 65535 的 TCP 端口。留空则使用 PI WEB 的默认值。</small>
                </label>

                <div className={styles.field}>
                  <span className={styles.fieldHeading}><span>允许的主机</span>{renderOverrideBadge("allowedHosts")}</span>
                  <select
                    value={gatewayDraft.allowedHostsMode}
                    onChange={(event) => { updateGateway({ allowedHostsMode: event.target.value === "all" ? "all" : "list" }); }}
                  >
                    <option value="list">仅列出的主机</option>
                    <option value="all">允许所有主机</option>
                  </select>
                  <textarea
                    value={gatewayDraft.allowedHostsText}
                    disabled={gatewayDraft.allowedHostsMode === "all"}
                    rows={4}
                    placeholder={"example.local\n192.168.1.20"}
                    spellCheck={false}
                    onChange={(event) => { updateGateway({ allowedHostsText: event.target.value }); }}
                  />
                  <small>每行输入一个主机，或选择“允许所有主机”以写入 <code>true</code>。</small>
                </div>

                <section className={styles.effectiveCard} aria-label="生效的网关配置摘要">
                  <h3>环境变量覆盖后生效的网关设置</h3>
                  <dl>
                    <div><dt>主机</dt><dd>{effectiveText(configResponse?.effectiveConfig.host, "默认 127.0.0.1")}</dd></div>
                    <div><dt>端口</dt><dd>{effectiveText(configResponse?.effectiveConfig.port, "默认 8504")}</dd></div>
                    <div><dt>允许的主机</dt><dd>{formatAllowedHosts(configResponse?.effectiveConfig.allowedHosts)}</dd></div>
                  </dl>
                </section>

                <footer className={styles.formActions}>
                  <button type="submit" className={styles.primary} disabled={loading || saving}>{saving ? "保存中…" : "保存网关服务器配置"}</button>
                </footer>
              </form>
            </>
          )}
        </section>

        {/* Selected machine file access + uploads */}
        <section className={styles.card} aria-label="选中机器文件访问与上传设置">
          <div className={styles.cardHeading}>
            <h3>选中机器的文件访问与上传</h3>
            <p>外部文件系统根目录和上传默认值保存在{props.targetLabel}上。</p>
          </div>
          {machineErr !== "" && <div className={clsx(styles.notice, styles.error)} role="alert">{machineErr}</div>}
          {machineConfigResponse === undefined ? (
            <div className={styles.loadingCard}>
              {machineLoading ? "正在加载选中机器的文件访问配置…" : "选中机器的文件访问配置不可用。请在保存文件/上传设置前重新加载。"}
            </div>
          ) : (
            <>
              <div className={styles.configPathCard}>
                <span>选中机器配置文件</span>
                <code>{machineConfigResponse.path}</code>
                <small>{machineConfigResponse.exists ? "已有文件" : "此文件将在保存时创建"}</small>
              </div>
              <form className={styles.form} onSubmit={(event) => void saveMachine(event)}>
                <label className={styles.field}>
                  <span className={styles.fieldHeading}><span>外部文件系统根目录</span></span>
                  <textarea
                    value={machineDraft.allowedPathsText}
                    rows={4}
                    placeholder={"~/SDKs\n/opt/reference"}
                    spellCheck={false}
                    onChange={(event) => { updateMachine({ allowedPathsText: event.target.value }); }}
                  />
                  <small>{props.targetLabel}上工作区之外的绝对 <code>@</code> 补全和文件浏览器读取的允许列表。每行输入一个绝对路径、Windows 绝对路径或以 <code>~</code> 开头的路径。留空则默认拒绝外部路径。</small>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldHeading}><span>默认上传文件夹</span></span>
                  <input
                    value={machineDraft.uploadDefaultFolder}
                    placeholder={DEFAULT_WORKSPACE_UPLOADS_FOLDER}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => { updateMachine({ uploadDefaultFolder: event.target.value }); }}
                  />
                  <small>{props.targetLabel}上手动文件上传的工作区相对文件夹。留空则使用 PI WEB 的默认值 <code>{DEFAULT_WORKSPACE_UPLOADS_FOLDER}</code>。</small>
                </label>

                <section className={styles.effectiveCard} aria-label="生效的选中机器文件访问与上传摘要">
                  <h3>选中机器的生效设置</h3>
                  <dl>
                    <div><dt>外部根目录</dt><dd>{formatAllowedPaths(machineConfigResponse.effectiveConfig.pathAccess?.allowedPaths)}</dd></div>
                    <div><dt>上传文件夹</dt><dd>{effectiveText(machineConfigResponse.effectiveConfig.uploads?.defaultFolder, `默认 ${DEFAULT_WORKSPACE_UPLOADS_FOLDER}`)}</dd></div>
                  </dl>
                </section>

                <footer className={styles.formActions}>
                  <button type="submit" className={styles.primary} disabled={machineLoading || saving}>{saving ? "保存中…" : "保存文件/上传配置"}</button>
                </footer>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function effectiveText(value: string | number | undefined, fallback: string): JSX.Element | string {
  if (value === undefined) return <span className={styles.muted}>{fallback}</span>;
  return String(value);
}

function formatAllowedHosts(value: PiWebConfigValues["allowedHosts"]): JSX.Element | string {
  if (value === true) return "任意主机";
  if (Array.isArray(value)) return value.length === 0 ? <span className={styles.muted}>未列出</span> : value.join(", ");
  return <span className={styles.muted}>未设置</span>;
}

function formatAllowedPaths(value: string[] | undefined): JSX.Element | string {
  if (value === undefined || value.length === 0) return <span className={styles.muted}>已拒绝外部路径</span>;
  return value.join(", ");
}
