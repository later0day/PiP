import clsx from "clsx";
import { type JSX, useEffect, useRef, useState } from "react";
import type { AppAction } from "@client/actions";
import type { PiWebConfigResponse, PiWebConfigValues, PiWebShortcutConfig } from "@shared/apiTypes";
import {
  formatShortcut,
  isShortcutSequenceStarter,
  parseShortcutInput,
  resolveShortcutBindings,
  shortcutPreferenceForAction,
  shortcutSequenceTimeoutMs,
  shortcutTokenFromEvent,
  type ShortcutBindingResolution,
} from "@client/keyboardShortcuts";
import { readPromptEnterPreference, writePromptEnterPreference, type PromptEnterPreference } from "@client/promptEnterBehavior";
import styles from "./SettingsShortcutsPanel.module.css";

// SettingsShortcutsPanel — React port of the Lit settings-shortcuts-panel. Edit
// per-action shortcuts (type, record from keyboard, disable with None, reset to
// default), a chat-composer Enter-key preference, and a live conflict/shadow
// resolution view. All shortcut parsing/resolution + the prompt-enter storage
// come from the reused pure modules; only the recording keydown listener,
// draft/recording state, and save-patch assembly live here.

const RECORD_LISTENER_OPTIONS = { capture: true } as const;

const PROMPT_ENTER_OPTIONS: readonly { value: PromptEnterPreference; label: string; description: string }[] = [
  { value: "auto", label: "自动/默认", description: "类似桌面：Enter 发送；移动端、粗略指针或窄屏则插入换行。" },
  { value: "send", label: "Enter 发送消息", description: "Enter 发送聊天消息；受支持时 Shift+Enter 换行。" },
  { value: "newline", label: "Enter 插入换行", description: "Enter 换行；受支持时 Shift+Enter 发送聊天消息。" },
];

type ShortcutState = "default" | "custom" | "disabled" | "unassigned";

interface RecordingState {
  actionId: string;
  tokens: string[];
}

export interface SettingsShortcutsPanelProps {
  actions: AppAction[];
  configResponse: PiWebConfigResponse | undefined;
  loading: boolean;
  saving: boolean;
  error: string;
  savedMessage: string;
  onReload: () => void;
  onSave: (config: PiWebConfigValues) => void | Promise<void>;
}

export function SettingsShortcutsPanel(props: SettingsShortcutsPanelProps): JSX.Element {
  const { actions, configResponse, loading, saving } = props;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState("");
  const [promptEnter, setPromptEnter] = useState<PromptEnterPreference>(() => readPromptEnterPreference());
  const [recording, setRecording] = useState<RecordingState | undefined>(undefined);
  const recordingRef = useRef<RecordingState | undefined>(undefined);
  recordingRef.current = recording;
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reseed drafts + stop recording whenever a fresh config response arrives
  // (mirrors the Lit willUpdate reseed).
  useEffect(() => {
    if (configResponse !== undefined) {
      setDrafts({});
      setLocalError("");
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on new response identity
  }, [configResponse]);

  useEffect(() => {
    return () => { stopRecording(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only
  }, []);

  function clearRecordingTimer(): void {
    if (recordingTimer.current !== undefined) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = undefined;
    }
  }

  function stopRecording(): void {
    clearRecordingTimer();
    window.removeEventListener("keydown", onRecordKeyDown, RECORD_LISTENER_OPTIONS);
    setRecording(undefined);
  }

  function armRecordingTimer(): void {
    clearRecordingTimer();
    recordingTimer.current = setTimeout(() => {
      recordingTimer.current = undefined;
      stopRecording();
    }, shortcutSequenceTimeoutMs);
  }

  function onRecordKeyDown(event: KeyboardEvent): void {
    const current = recordingRef.current;
    if (current === undefined) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      stopRecording();
      return;
    }
    const token = shortcutTokenFromEvent(event);
    if (token === undefined) {
      setLocalError("请按字母、数字、标点、功能键或导航键。按 Esc 取消录制。");
      return;
    }
    if (current.tokens.length === 0 && !isShortcutSequenceStarter(token)) {
      setLocalError("快捷键请以 Ctrl/⌘ 或 Alt 开头，以免捕获正常输入。");
      return;
    }
    const tokens = [...current.tokens, token];
    setLocalError("");
    setDrafts({ [current.actionId]: tokens.join(" ") });
    setRecording({ actionId: current.actionId, tokens });
    recordingRef.current = { actionId: current.actionId, tokens };
    armRecordingTimer();
  }

  const toggleRecording = (actionId: string): void => {
    if (recordingRef.current?.actionId === actionId) {
      stopRecording();
      return;
    }
    stopRecording();
    setLocalError("");
    const next: RecordingState = { actionId, tokens: [] };
    setRecording(next);
    recordingRef.current = next;
    window.addEventListener("keydown", onRecordKeyDown, RECORD_LISTENER_OPTIONS);
    // Focus the matching input after the render commits.
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`.${String(styles.input)}[data-action-id="${cssEscape(actionId)}"]`);
      input?.focus();
      input?.select();
    });
  };

  const shortcutInputText = (action: AppAction): string => {
    const draft = drafts[action.id];
    if (draft !== undefined) return draft;
    const configured = shortcutPreferenceForAction(action, configResponse?.config.shortcuts);
    if (configured === null) return "";
    return configured ?? action.shortcut ?? "";
  };

  const updateDraft = (actionId: string, value: string): void => {
    setDrafts({ [actionId]: value });
    setLocalError("");
  };

  const saveShortcutPreference = async (action: AppAction, shortcut: string | null | undefined): Promise<void> => {
    const config: PiWebConfigValues = { ...(configResponse?.config ?? {}) };
    const currentShortcuts = config.shortcuts ?? {};
    const migrated = withoutShortcutPreferences(currentShortcuts, [action.id, ...(action.shortcutAliases ?? [])]);
    const shortcuts = shortcut === undefined ? migrated : { ...migrated, [action.id]: shortcut };
    if (Object.keys(shortcuts).length === 0) delete config.shortcuts;
    else config.shortcuts = shortcuts;
    await props.onSave(config);
  };

  const saveShortcut = async (action: AppAction): Promise<void> => {
    stopRecording();
    const parsed = parseShortcutInput(shortcutInputText(action).trim());
    if (!parsed.ok) {
      setLocalError(parsed.message);
      return;
    }
    setLocalError("");
    await saveShortcutPreference(action, parsed.shortcut);
  };

  const setShortcutNone = async (action: AppAction): Promise<void> => {
    stopRecording();
    setLocalError("");
    await saveShortcutPreference(action, null);
  };

  const resetShortcut = async (action: AppAction): Promise<void> => {
    stopRecording();
    setLocalError("");
    await saveShortcutPreference(action, undefined);
  };

  const updatePromptEnter = (preference: PromptEnterPreference): void => {
    setPromptEnter(preference);
    writePromptEnterPreference(preference);
  };

  // Live conflict/shadow resolution over the draft-augmented config.
  const previewShortcuts = ((): PiWebShortcutConfig | undefined => {
    const shortcuts = { ...(configResponse?.config.shortcuts ?? {}) };
    for (const [actionId, draft] of Object.entries(drafts)) {
      const trimmed = draft.trim();
      if (trimmed === "") continue;
      const parsed = parseShortcutInput(trimmed);
      if (parsed.ok) shortcuts[actionId] = parsed.shortcut;
    }
    return Object.keys(shortcuts).length === 0 ? undefined : shortcuts;
  })();
  const resolutions = new Map(
    resolveShortcutBindings(actions, previewShortcuts, { enabledOnly: true }).map((r) => [r.action.id, r]),
  );

  const groups = shortcutGroups(actions);
  const error = localError || props.error;

  return (
    <section className={styles.panel} aria-label="键盘快捷键">
      <header className={styles.panelHeader}>
        <div className={styles.headingCopy}>
          <h2>键盘快捷键</h2>
          <p>按操作编辑应用快捷键。输入如 <code>mod+k</code> 或 <code>mod+g p</code> 的快捷键，从键盘录制，用“无”禁用，或重置为默认。当快捷键冲突时，自定义快捷键优先于默认；平局按操作 id 解决，且相同前缀下较短的快捷键会遮蔽较长的序列。</p>
        </div>
        <button type="button" className={styles.secondary} disabled={loading} onClick={props.onReload}>重新加载</button>
      </header>

      {error !== "" && <div className={clsx(styles.notice, styles.error)} role="alert">{error}</div>}
      {props.savedMessage !== "" && <div className={clsx(styles.notice, styles.success)} role="status">{props.savedMessage}</div>}

      <section className={styles.promptEnterCard} aria-labelledby="prompt-enter-preference-title">
        <div className={styles.promptEnterCopy}>
          <span className={styles.cardEyebrow}>聊天编辑器</span>
          <h3 id="prompt-enter-preference-title">Enter 键行为</h3>
          <p>选择 Enter 在此浏览器中的行为。受支持时 Shift+Enter 执行相反操作；自动触屏键盘的大写会被忽略以避免误发送。</p>
        </div>
        <div className={styles.promptEnterOptions} role="radiogroup" aria-label="聊天编辑器中 Enter 和 Shift+Enter 的行为">
          {PROMPT_ENTER_OPTIONS.map((option) => (
            <label key={option.value} className={styles.promptEnterOption}>
              <input
                type="radio"
                name="prompt-enter-preference"
                value={option.value}
                checked={promptEnter === option.value}
                onChange={() => { updatePromptEnter(option.value); }}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      {configResponse === undefined && loading ? (
        <div className={styles.loadingCard}>正在加载快捷键…</div>
      ) : (
        <>
          <div className={styles.configPathCard}>
            <span>配置文件</span>
            <code>{configResponse?.path ?? "未知"}</code>
            <small>快捷键覆盖保存在 <code>shortcuts</code> 下。值为 <code>null</code> 会禁用该操作的快捷键。</small>
          </div>
          {groups.length === 0 ? (
            <div className={styles.loadingCard}>未注册任何操作。</div>
          ) : (
            groups.map((group) => (
              <section key={group.name} className={styles.group}>
                <h3>{group.name}</h3>
                <div className={styles.list}>
                  {group.actions.map((action) => (
                    <ShortcutRow
                      key={action.id}
                      action={action}
                      resolution={resolutions.get(action.id)}
                      shortcuts={configResponse?.config.shortcuts}
                      inputText={shortcutInputText(action)}
                      hasDraft={drafts[action.id] !== undefined}
                      recordingActionId={recording?.actionId}
                      recordingTokens={recording?.tokens ?? []}
                      loading={loading}
                      saving={saving}
                      onInput={(value) => { updateDraft(action.id, value); }}
                      onSave={() => void saveShortcut(action)}
                      onRecord={() => { toggleRecording(action.id); }}
                      onNone={() => void setShortcutNone(action)}
                      onReset={() => void resetShortcut(action)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </section>
  );
}

interface ShortcutRowProps {
  action: AppAction;
  resolution: ShortcutBindingResolution | undefined;
  shortcuts: PiWebShortcutConfig | undefined;
  inputText: string;
  hasDraft: boolean;
  recordingActionId: string | undefined;
  recordingTokens: string[];
  loading: boolean;
  saving: boolean;
  onInput: (value: string) => void;
  onSave: () => void;
  onRecord: () => void;
  onNone: () => void;
  onReset: () => void;
}

function ShortcutRow(props: ShortcutRowProps): JSX.Element {
  const { action, resolution, shortcuts, inputText, hasDraft, loading, saving } = props;
  const configured = shortcutPreferenceForAction(action, shortcuts);
  const state = shortcutState(action, shortcuts);
  const parsedInput = inputText.trim() === "" ? undefined : parseShortcutInput(inputText);
  const previewShortcut = parsedInput?.ok === true ? parsedInput.shortcut : effectiveShortcut(action, shortcuts);
  const hasConfiguredShortcut = configured !== undefined;
  const displayState: ShortcutState = hasDraft && inputText.trim() !== "" ? "custom" : state;
  const conflictLabel = shortcutConflictLabel(resolution);
  const recording = props.recordingActionId === action.id;
  const recordingHint = !recording
    ? ""
    : props.recordingTokens.length === 0
      ? "录制中：按 Ctrl/⌘ 或 Alt 加一个键。按 Esc 取消。"
      : `录制中：${formatShortcut(props.recordingTokens.join(" "))}。按另一个键以添加序列，或等待完成。`;

  return (
    <article className={rowClass(resolution)}>
      <div className={styles.main}>
        <strong>{action.title}</strong>
        {action.description !== undefined && action.description !== "" ? <small>{action.description}</small> : null}
        <small className={styles.id}>{action.id}</small>
        <small>
          {action.shortcut !== undefined && action.shortcut !== "" ? (
            <>默认：<kbd className={styles.kbd}>{formatShortcut(action.shortcut)}</kbd></>
          ) : (
            "无默认快捷键"
          )}
        </small>
      </div>
      <div className={styles.editor}>
        <div className={styles.status}>
          {previewShortcut !== undefined && previewShortcut !== "" ? (
            <kbd className={styles.kbd}>{formatShortcut(previewShortcut)}</kbd>
          ) : (
            <span className={styles.unassigned}>{state === "disabled" ? "已禁用" : "未分配"}</span>
          )}
          <small className={stateClass(displayState)}>{shortcutStateLabel(displayState)}{hasDraft ? " · 未保存" : ""}</small>
          {conflictLabel !== undefined && <small className={conflictClass(resolution)}>{conflictLabel}</small>}
        </div>
        <label className={styles.inputLabel}>
          <span>快捷键</span>
          <input
            className={styles.input}
            data-action-id={action.id}
            value={inputText}
            placeholder={action.shortcut ?? "mod+k"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={saving}
            onChange={(event) => { props.onInput(event.target.value); }}
          />
        </label>
        {recordingHint !== "" && <small className={styles.recordingHint}>{recordingHint}</small>}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={loading || saving || !hasDraft || inputText.trim() === ""} onClick={props.onSave}>保存</button>
          <button type="button" className={styles.button} disabled={loading || saving} onClick={props.onRecord}>{recording ? "取消录制" : "录制"}</button>
          <button type="button" className={styles.button} disabled={loading || saving || configured === null} onClick={props.onNone}>无</button>
          <button type="button" className={styles.button} disabled={loading || saving || !hasConfiguredShortcut} onClick={props.onReset}>重置</button>
        </div>
      </div>
    </article>
  );
}

function rowClass(resolution: ShortcutBindingResolution | undefined): string {
  if (resolution?.active === false) return clsx(styles.row, styles.shadowed);
  if (resolution?.active === true && resolution.shadows.length > 0) return clsx(styles.row, styles.shadowing);
  return styles.row ?? "";
}

function conflictClass(resolution: ShortcutBindingResolution | undefined): string {
  return resolution?.active === false ? clsx(styles.conflict, styles.conflictShadowed) : clsx(styles.conflict, styles.conflictShadowing);
}

function shortcutConflictLabel(resolution: ShortcutBindingResolution | undefined): string | undefined {
  if (resolution === undefined) return undefined;
  if (!resolution.active) return `被 ${resolution.shadowedBy?.action.title ?? "另一操作"} 遮蔽`;
  const shadowedCount = resolution.shadows.length;
  if (shadowedCount === 0) return undefined;
  const shadowedNames = resolution.shadows.slice(0, 2).map((binding) => binding.action.title).join("、");
  const suffix = shadowedCount > 2 ? `，还有 ${String(shadowedCount - 2)} 个` : "";
  return `遮蔽了 ${String(shadowedCount)} 个操作：${shadowedNames}${suffix}`;
}

function shortcutGroups(actions: AppAction[]): { name: string; actions: AppAction[] }[] {
  const grouped = new Map<string, AppAction[]>();
  for (const action of [...actions].sort(compareActions)) {
    const group = action.group ?? "其他";
    grouped.set(group, [...(grouped.get(group) ?? []), action]);
  }
  return [...grouped.entries()].map(([name, groupActions]) => ({ name, actions: groupActions }));
}

function compareActions(left: AppAction, right: AppAction): number {
  return (left.group ?? "其他").localeCompare(right.group ?? "其他") || left.title.localeCompare(right.title);
}

function withoutShortcutPreferences(shortcuts: PiWebShortcutConfig, actionIds: readonly string[]): PiWebShortcutConfig {
  const removed = new Set(actionIds);
  return Object.fromEntries(Object.entries(shortcuts).filter(([shortcutActionId]) => !removed.has(shortcutActionId)));
}

function effectiveShortcut(action: AppAction, shortcuts: PiWebShortcutConfig | undefined): string | undefined {
  const configured = shortcutPreferenceForAction(action, shortcuts);
  if (configured === null) return undefined;
  return configured ?? action.shortcut;
}

function shortcutState(action: AppAction, shortcuts: PiWebShortcutConfig | undefined): ShortcutState {
  const configured = shortcutPreferenceForAction(action, shortcuts);
  if (configured === null) return "disabled";
  if (configured !== undefined) return "custom";
  return action.shortcut === undefined || action.shortcut === "" ? "unassigned" : "default";
}

function shortcutStateLabel(state: ShortcutState): string {
  switch (state) {
    case "default": return "默认";
    case "custom": return "自定义";
    case "disabled": return "已禁用";
    case "unassigned": return "无默认";
  }
}

function stateClass(state: ShortcutState): string | undefined {
  switch (state) {
    case "custom": return styles.custom;
    case "disabled": return styles.disabled;
    case "default":
    case "unassigned": return styles.default;
  }
}

// Minimal CSS.escape fallback for the data-attribute selector (action ids are
// simple, but guard against special characters just in case).
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
