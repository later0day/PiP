import { type JSX, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ModalSurface } from "../../primitives";
import type { AuthDialogState } from "@client/appState";
import type { AuthProviderOption, AuthType } from "@shared/apiTypes";
import { isBrowserRemoteOAuthMachine, oauthPromptInputType } from "@client/components/AuthDialog";
import styles from "./AuthDialog.module.css";

// AuthDialog — React port of the Lit auth-dialog. A four-step overlay driven by
// the reused AuthController via useAuth: `method` (subscription vs credentials),
// `providers` / `logout` (searchable, roving-keyboard option lists), and `oauth`
// (the live login flow — auth link/device code, prompt input, inline selects,
// progress + error surfaces). Structure/interaction ported verbatim; the pure
// helpers (oauthPromptInputType, isBrowserRemoteOAuthMachine) are imported from
// the legacy module unchanged. DSH-skinned on the shared ModalSurface.

interface AuthDialogOption {
  key: string;
  title: JSX.Element | string;
  detail: string;
  searchText: string;
  run: () => void;
}

export interface AuthDialogProps {
  state: AuthDialogState;
  onChooseMethod: (authType: AuthType) => void;
  onSelectProvider: (providerId: string, authType: AuthType) => void;
  onLogoutProvider: (providerId: string) => void;
  onOAuthInput: (value: string) => void;
  onOAuthRespond: (value?: string) => void;
  onOAuthCancel: () => void;
  onCancel: () => void;
}

function dialogTitle(state: AuthDialogState): string {
  switch (state.step) {
    case "method":
      return "配置服务商认证";
    case "providers":
      return state.authType === undefined
        ? "选择服务商认证"
        : state.authType === "oauth"
          ? "选择订阅服务商"
          : "选择凭据服务商";
    case "oauth":
      return `登录到 ${state.flow.providerName}`;
    case "logout":
      return "移除已存储的服务商认证";
  }
}

export function AuthDialog(props: AuthDialogProps): JSX.Element {
  const { state } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");

  // Selection + search are scoped to the visible list: reset when the step
  // changes (mirrors the Lit willUpdate step guard).
  useEffect(() => {
    setSelectedIndex(0);
    setQuery("");
  }, [state.step]);

  const options = useMemo(() => optionsFor(state, props), [state, props]);
  const visible = useMemo(() => filterOptions(options, query), [options, query]);
  const hasSearch = state.step === "providers" || state.step === "logout";

  // Clamp the roving selection into the filtered list.
  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  const cancel = (): void => {
    if (state.step === "oauth") props.onOAuthCancel();
    else props.onCancel();
  };

  const onKeyDown = (event: ReactKeyboardEvent): void => {
    if (originatesFromNativeControl(event)) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (visible.length === 0) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setSelectedIndex((current) => (current + delta + visible.length) % visible.length);
      return;
    }
    if (event.key !== "Enter") return;
    if (state.step === "oauth") {
      if (state.flow.prompt === undefined) return;
      event.preventDefault();
      props.onOAuthRespond();
      return;
    }
    const option = visible[selectedIndex];
    if (option === undefined) return;
    event.preventDefault();
    option.run();
  };

  return (
    <ModalSurface onClose={cancel} label={dialogTitle(state)} className={styles.surface}>
      <div className={styles.inner} onKeyDown={onKeyDown}>
        <header className={styles.header}>
          <strong>{dialogTitle(state)}</strong>
          <button type="button" className={styles.close} title="关闭" aria-label="关闭" onClick={cancel}>
            ×
          </button>
        </header>
        {state.step === "oauth" ? (
          <OAuthBody state={state} onInput={props.onOAuthInput} onRespond={props.onOAuthRespond} onCancelFlow={props.onOAuthCancel} onClose={cancel} />
        ) : (
          <>
            {hasSearch && options.length > 0 && (
              <input
                className={styles.search}
                aria-label="搜索服务商"
                placeholder="搜索服务商"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
              />
            )}
            <div className={styles.options}>
              {options.length === 0 ? (
                <div className={styles.empty}>
                  {state.step === "logout"
                    ? "没有已存储的凭据。环境变量和 models.json 设置保持不变。"
                    : "没有可用的服务商。"}
                </div>
              ) : visible.length === 0 ? (
                <div className={styles.empty}>没有匹配的服务商</div>
              ) : (
                visible.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    className={clsx(styles.option, index === selectedIndex && styles.optionSelected)}
                    aria-current={index === selectedIndex ? "true" : undefined}
                    onFocus={() => { setSelectedIndex(index); }}
                    onClick={option.run}
                  >
                    <span>{option.title}</span>
                    <small>{option.detail}</small>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </ModalSurface>
  );
}

function optionsFor(state: AuthDialogState, props: AuthDialogProps): AuthDialogOption[] {
  switch (state.step) {
    case "method":
      return [
        {
          key: "oauth",
          title: "使用订阅",
          detail: "ChatGPT Plus/Pro、Claude Pro/Max 或 GitHub Copilot",
          searchText: "Use a subscription 使用订阅",
          run: () => { props.onChooseMethod("oauth"); },
        },
        {
          key: "api_key",
          title: "使用服务商凭据",
          detail: "在当前 Pi 兼容配置的 auth.json 中配置 API 密钥或服务商专用凭据",
          searchText: "Use provider credentials 使用服务商凭据",
          run: () => { props.onChooseMethod("api_key"); },
        },
      ];
    case "providers":
      return state.providers.map((provider) => ({
        key: provider.id,
        title: (
          <>
            {provider.name}
            {provider.status.source !== undefined && <em className={styles.statusEm}> {statusLabel(provider)}</em>}
          </>
        ),
        detail: `${provider.id} · ${authTypeLabel(provider.authType)}`,
        searchText: provider.name,
        run: () => { props.onSelectProvider(provider.id, provider.authType); },
      }));
    case "logout":
      return state.providers.map((provider) => ({
        key: provider.id,
        title: provider.name,
        detail: `${provider.id} · ${authTypeLabel(provider.authType)}`,
        searchText: provider.name,
        run: () => { props.onLogoutProvider(provider.id); },
      }));
    case "oauth":
      return [];
  }
}

function filterOptions(options: AuthDialogOption[], query: string): AuthDialogOption[] {
  const q = query.trim().toLowerCase();
  if (q === "") return options;
  return options.filter((option) => `${option.searchText} ${option.detail} ${option.key}`.toLowerCase().includes(q));
}

interface OAuthBodyProps {
  state: Extract<AuthDialogState, { step: "oauth" }>;
  onInput: (value: string) => void;
  onRespond: (value?: string) => void;
  onCancelFlow: () => void;
  onClose: () => void;
}

function OAuthBody({ state, onInput, onRespond, onCancelFlow, onClose }: OAuthBodyProps): JSX.Element {
  const promptRef = useRef<HTMLInputElement>(null);
  const flow = state.flow;
  const prompt = flow.prompt;
  const select = flow.select;
  const promptInputType = prompt === undefined ? undefined : oauthPromptInputType(prompt.promptType);
  const showPasteNote =
    isBrowserRemoteOAuthMachine(state.machineId, window.location.hostname) && flow.status === "running" && prompt?.promptType === "manual_code";

  // Refocus the prompt input when the interaction changes (step/interaction key
  // shift replaces the control; keep keyboard events from being stranded).
  useEffect(() => {
    promptRef.current?.focus();
  }, [flow.flowId, prompt?.requestId, state.responding]);

  return (
    <div className={styles.form}>
      {flow.auth !== undefined ? (
        <>
          <p>打开此授权链接：</p>
          <p>
            <a className={styles.link} href={flow.auth.url} target="_blank" rel="noreferrer">
              {flow.auth.url}
            </a>
          </p>
          {flow.auth.deviceCode !== undefined ? (
            <p className={styles.warning}>
              输入代码： <code className={styles.code}>{flow.auth.deviceCode.userCode}</code>
            </p>
          ) : flow.auth.instructions !== undefined ? (
            <p className={styles.warning}>{flow.auth.instructions}</p>
          ) : null}
        </>
      ) : (
        <p>正在启动登录流程…</p>
      )}
      {showPasteNote && (
        <p className={styles.warning}>
          授权通过后，重定向页面可能会加载失败——这是正常的。请从浏览器地址栏复制完整的 URL 并粘贴到下方。
        </p>
      )}
      {flow.progress.length > 0 && (
        <ul className={styles.progress}>
          {flow.progress.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
      {flow.info?.map((item, index) =>
        item.links === undefined || item.links.length === 0 ? null : (
          <div key={index} className={styles.infoLinks} aria-label="相关信息">
            {item.links.map((link) => (
              <a key={link.url} className={styles.link} href={link.url} target="_blank" rel="noreferrer" title={item.message}>
                {link.label ?? link.url}
              </a>
            ))}
          </div>
        ),
      )}
      {prompt !== undefined && (
        <>
          <label className={styles.label}>{prompt.message}</label>
          <input
            ref={promptRef}
            className={styles.search}
            type={promptInputType}
            autoComplete={promptInputType === "password" ? "off" : "on"}
            value={state.inputValue ?? ""}
            placeholder={prompt.placeholder ?? ""}
            onChange={(event) => { onInput(event.target.value); }}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={onCancelFlow}>
              取消
            </button>
            <button type="button" className={clsx(styles.button, styles.primary)} disabled={state.responding === true} onClick={() => { onRespond(); }}>
              提交
            </button>
          </div>
        </>
      )}
      {select !== undefined && (
        <>
          <p>{select.message}</p>
          <div className={styles.inlineOptions}>
            {select.options.map((option) => (
              <button key={option.value} type="button" className={styles.button} onClick={() => { onRespond(option.value); }}>
                <span>{option.label}</span>
                {option.description !== undefined && <small>{option.description}</small>}
              </button>
            ))}
          </div>
        </>
      )}
      {state.error !== undefined && state.error !== "" && <div className={styles.errorText}>{state.error}</div>}
      {(flow.status === "error" || flow.status === "cancelled") && (
        <>
          <div className={styles.errorText}>{flow.error ?? flow.status}</div>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={onClose}>
              关闭
            </button>
          </div>
        </>
      )}
      {prompt === undefined && select === undefined && flow.status === "running" && (
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onCancelFlow}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}

function authTypeLabel(authType: AuthType): string {
  return authType === "oauth" ? "订阅" : "凭据";
}

function statusLabel(provider: AuthProviderOption): string {
  if (provider.status.source === undefined) return "";
  switch (provider.status.source) {
    case "stored":
      return "✓ 已配置";
    case "environment":
      return `✓ 环境变量${provider.status.label === undefined ? "" : `: ${provider.status.label}`}`;
    case "runtime":
      return "✓ 运行时";
    case "fallback":
      return "✓ 自定义密钥";
    case "models_json_key":
      return "✓ models.json 密钥";
    case "models_json_command":
      return "✓ models.json 命令";
    default:
      return "";
  }
}

// The native buttons/inputs own their own Enter/Space activation, so list-level
// keyboard handling must ignore events that originate on them (mirrors the Lit
// keyboardEventOriginatesFromNativeActivationControl guard).
function originatesFromNativeControl(event: ReactKeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "A" || tag === "SELECT" || tag === "TEXTAREA") return true;
  if (tag === "INPUT") return true;
  if (tag === "BUTTON" && (event.key === "Enter" || event.key === " ")) return true;
  return false;
}
