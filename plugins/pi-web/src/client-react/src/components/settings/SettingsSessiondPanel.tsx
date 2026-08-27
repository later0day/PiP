import clsx from "clsx";
import type { JSX } from "react";
import type { PiWebConfigResponse, PiWebConfigValues } from "@shared/apiTypes";
import {
  askUserConfigPatch,
  spawnSessionsConfigPatch,
  subsessionsConfigPatch,
} from "@client/components/settings/settingsSessiondConfig";
import styles from "./SettingsPanels.module.css";

// SettingsSessiondPanel — React port of the Lit settings-sessiond-panel. Three
// tool-capability toggles (spawn sessions / subsessions / ask user) whose state
// is read from effectiveConfig (on-by-default semantics) and whose patches come
// from the pure settingsSessiondConfig module. Each toggle saves immediately.
// Environment-overridden toggles are locked; subsessions additionally require
// spawn to be enabled.

export interface SettingsSessiondPanelProps {
  configResponse: PiWebConfigResponse | undefined;
  loading: boolean;
  saving: boolean;
  error: string;
  savedMessage: string;
  targetLabel: string;
  onReload: () => void;
  onSave: (config: PiWebConfigValues) => void | Promise<void>;
}

export function SettingsSessiondPanel(props: SettingsSessiondPanelProps): JSX.Element {
  const { configResponse: config, loading, saving } = props;

  const spawnOverridden = config?.envOverrides.spawnSessions === true;
  const effectiveSpawn = config?.effectiveConfig.spawnSessions !== false;
  const subsessionsOverridden = config?.envOverrides.subsessions === true;
  const effectiveSubsessions = config?.effectiveConfig.subsessions === true && effectiveSpawn;
  const askUserOverridden = config?.envOverrides.askUser === true;
  const effectiveAskUser = config?.effectiveConfig.askUser === true;

  return (
    <section className={styles.panel} aria-label="会话守护进程">
      <header className={styles.panelHeader}>
        <div className={styles.headingCopy}>
          <h2>会话守护进程</h2>
          <p>{props.targetLabel}上会话的智能体工具能力。更改会立即保存，但只有在该机器的会话守护进程重启后才会生效。</p>
        </div>
        <button type="button" className={styles.secondary} disabled={loading} onClick={props.onReload}>
          重新加载
        </button>
      </header>

      {props.error !== "" && <div className={clsx(styles.notice, styles.error)} role="alert">{props.error}</div>}
      {props.savedMessage !== "" && <div className={clsx(styles.notice, styles.success)} role="status">{props.savedMessage}</div>}

      {config === undefined ? (
        <div className={styles.loadingCard}>{loading ? "正在加载配置…" : "配置不可用。请重新加载以重试。"}</div>
      ) : (
        <div className={styles.sections}>
          <div className={styles.configPathCard}>
            <span>配置文件</span>
            <code>{config.path}</code>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldHeading}>
              <span>允许智能体启动会话</span>
              {spawnOverridden && <span className={styles.overrideBadge}>环境变量覆盖</span>}
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={effectiveSpawn}
                disabled={loading || saving || spawnOverridden}
                onChange={(event) => void props.onSave(spawnSessionsConfigPatch(event.target.checked))}
              />
              <span>启用 <code>spawn_session</code> 工具</span>
            </label>
            <small>启用后，LLM 可以启动新会话，限定在同一已注册项目的工作区（任意 worktree）内，以确保每个派生的会话在此处可见。默认开启。</small>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldHeading}>
              <span>允许智能体启动被跟踪的子会话</span>
              {subsessionsOverridden && <span className={styles.overrideBadge}>环境变量覆盖</span>}
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={effectiveSubsessions}
                disabled={loading || saving || subsessionsOverridden || !effectiveSpawn}
                onChange={(event) => void props.onSave(subsessionsConfigPatch(event.target.checked))}
              />
              <span>启用 <code>spawn_subsession</code> 工具</span>
            </label>
            <small>智能体可以启动其保持连接的子会话（<code>spawn_subsession</code>、<code>list_subsessions</code>、<code>check_subsession</code>、<code>read_subsession</code>），并在子会话完成时收到通知。需要“允许智能体启动会话”。默认开启。</small>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldHeading}>
              <span>允许智能体提出问题</span>
              {askUserOverridden && <span className={styles.overrideBadge}>环境变量覆盖</span>}
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                aria-label="启用提问"
                checked={effectiveAskUser}
                disabled={loading || saving || askUserOverridden}
                onChange={(event) => void props.onSave(askUserConfigPatch(event.target.checked))}
              />
              <span>启用 <code>ask_user</code> 工具</span>
            </label>
            <small>智能体可以发布结构化的提问表单并暂停，直到用户回复。默认开启。</small>
          </div>

          <section className={styles.effectiveCard} aria-label="期望的会话守护进程配置摘要">
            <h3>环境变量覆盖后的期望值</h3>
            <dl>
              <div><dt>派生会话</dt><dd>{effectiveSpawn ? "已启用" : <span className={styles.muted}>已禁用</span>}</dd></div>
              <div><dt>子会话</dt><dd>{effectiveSubsessions ? "已启用" : <span className={styles.muted}>已禁用</span>}</dd></div>
              <div><dt>提问</dt><dd>{effectiveAskUser ? "已启用" : <span className={styles.muted}>已禁用</span>}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
