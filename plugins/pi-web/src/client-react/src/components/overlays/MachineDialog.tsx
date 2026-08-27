import { type JSX, useCallback, useRef, useState } from "react";
import { ModalSurface } from "../../primitives";
import styles from "./MachineDialog.module.css";

// MachineDialog — the add-machine surface (legacy MachineDialog.ts). A URL field
// suggests a friendly name, then reveals name + optional bearer-token fields.
// The pure URL helpers are copied verbatim (the legacy module registers a custom
// element on import, so it can't be imported directly). DSH-skinned on
// ModalSurface.

export interface MachineDialogSubmit {
  name: string;
  baseUrl: string;
  token?: string;
}

export function suggestedMachineNameFromUrl(value: string): string {
  const raw = value.trim();
  if (raw === "") return "";
  const parsed = parseUrlForSuggestion(raw) ?? parseUrlForSuggestion(`http://${raw.replace(/^\/+/u, "")}`);
  if (parsed !== undefined && parsed.hostname !== "") return parsed.hostname.replace(/^\[(.*)\]$/u, "$1");
  return fallbackSuggestedName(raw);
}

export function machineBaseUrlValidationMessage(value: string): string | undefined {
  const raw = value.trim();
  if (raw === "") return "需要填写远程 PI WEB 地址。";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "请输入包含 http:// 或 https:// 的有效地址。";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "请使用 http:// 或 https:// 地址。";
  if (url.username !== "" || url.password !== "") return "机器地址中不要包含凭据。";
  if (url.search !== "" || url.hash !== "") return "不要包含查询字符串或片段。";
  return undefined;
}

function parseUrlForSuggestion(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function fallbackSuggestedName(value: string): string {
  const withoutProtocol = value.replace(/^[a-z][a-z\d+.-]*:\/\//iu, "");
  const withoutCredentials = withoutProtocol.slice(withoutProtocol.lastIndexOf("@") + 1);
  const host = withoutCredentials.split(/[/?#]/u)[0] ?? "";
  if (host.startsWith("[") && host.includes("]")) return host.slice(1, host.indexOf("]"));
  return host.replace(/:\d+$/u, "");
}

export interface MachineDialogProps {
  error?: string;
  onSubmit: (input: MachineDialogSubmit) => void | Promise<void>;
  onCancel: () => void;
}

export function MachineDialog({ error = "", onSubmit, onCancel }: MachineDialogProps): JSX.Element {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameEdited = useRef(false);
  const previousSuggestedName = useRef("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const onUrlInput = useCallback((value: string): void => {
    const suggested = suggestedMachineNameFromUrl(value);
    setName((current) => {
      if (!nameEdited.current || current.trim() === "" || current === previousSuggestedName.current) return suggested;
      return current;
    });
    previousSuggestedName.current = suggested;
    setUrl(value);
  }, []);

  const validInput = useCallback((): MachineDialogSubmit | undefined => {
    const baseUrl = url.trim();
    const trimmedName = name.trim();
    if (baseUrl === "" || trimmedName === "" || machineBaseUrlValidationMessage(baseUrl) !== undefined) return undefined;
    const trimmedToken = token.trim();
    return { name: trimmedName, baseUrl, ...(trimmedToken === "" ? {} : { token: trimmedToken }) };
  }, [url, name, token]);

  const submit = useCallback(async (): Promise<void> => {
    const input = validInput();
    if (input === undefined || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(input);
    } finally {
      setSubmitting(false);
    }
  }, [validInput, submitting, onSubmit]);

  // Enter on the URL field (once valid) advances to the name field; matches the
  // legacy form's Enter-to-advance behavior. Escape/backdrop close via the modal.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      const target = event.target;
      if (
        event.key === "Enter" &&
        target instanceof HTMLInputElement &&
        target.name === "baseUrl" &&
        machineBaseUrlValidationMessage(url) === undefined
      ) {
        event.preventDefault();
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }
    },
    [url],
  );

  const hasUrl = url.trim() !== "";
  const urlError = hasUrl ? machineBaseUrlValidationMessage(url) : undefined;
  const canSubmit = validInput() !== undefined && !submitting;

  return (
    <ModalSurface
      onClose={onCancel}
      busy={submitting}
      initialFocus="input[name='baseUrl']"
      label="添加机器"
      className={styles.surface}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <strong>添加机器</strong>
          <button type="button" className={styles.close} onClick={onCancel} aria-label="关闭">
            ×
          </button>
        </header>
        <div className={styles.body}>
          {error === "" ? null : (
            <div className={styles.dialogError} role="alert">
              {error}
            </div>
          )}
          <label className={styles.field}>
            远程 PI WEB 地址
            <input
              name="baseUrl"
              type="url"
              className={styles.input}
              value={url}
              onChange={(event) => { onUrlInput(event.target.value); }}
              placeholder="http://dev-box.local:8504"
              autoComplete="url"
              inputMode="url"
            />
          </label>
          <small className={urlError === undefined ? styles.hint : styles.fieldError}>
            {urlError ?? "请先输入可访问的基础地址，包含 http:// 或 https://。"}
          </small>
          {hasUrl ? (
            <>
              <label className={styles.field}>
                机器名称
                <input
                  ref={nameInputRef}
                  name="name"
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(event) => {
                    nameEdited.current = true;
                    setName(event.target.value);
                  }}
                  placeholder={previousSuggestedName.current || "Dev Box"}
                  autoComplete="off"
                />
              </label>
              <small className={styles.hint}>
                根据地址推荐。可编辑为更友好的侧栏名称。
              </small>
              <label className={styles.field}>
                Bearer 令牌 <span className={styles.optional}>可选</span>
                <input
                  name="token"
                  type="password"
                  className={styles.input}
                  value={token}
                  onChange={(event) => { setToken(event.target.value); }}
                  placeholder="若远程机器无需令牌可留空"
                  autoComplete="off"
                />
              </label>
              <small className={styles.hint}>
                只需粘贴令牌值；PI WEB 会以 Authorization: Bearer 头发送。
              </small>
            </>
          ) : (
            <p className={styles.intro}>
              输入地址后，PI WEB 会推荐机器名称并允许你添加可选的 bearer 令牌。
            </p>
          )}
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.button} onClick={onCancel}>
            取消
          </button>
          <button type="submit" className={styles.primary} disabled={!canSubmit}>
            {submitting ? "添加中…" : "添加机器"}
          </button>
        </footer>
      </form>
    </ModalSurface>
  );
}
