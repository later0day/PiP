import { type JSX, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { inputModeForDraft, type InputMode } from "@client/inputModes";
import { clearDraft, loadDraft, saveDraft } from "@client/promptDraftStorage";
import { machineSessionKey } from "@client/machineKeys";
import {
  createMobilePromptEnterMedia,
  readPromptEnterPreference,
  shouldSendPromptOnEnterShortcut,
} from "@client/promptEnterBehavior";
import { thinkingGauge, thinkingLevelLabel } from "@shared/thinkingLevels";
import type { PromptAttachment, PromptAttachmentDelivery, SessionModel, SessionRef } from "@shared/apiTypes";
import {
  isInlinePromptAttachment,
  promptAttachmentsCanUseInlineDelivery,
} from "@client/promptAttachmentCapture";
import { useCompletions } from "../../state/useCompletions";
import { useAttachments } from "../../state/useAttachments";
import type { CompletionItem } from "../../state/completionTypes";
import { AutocompleteMenu } from "./AutocompleteMenu";
import styles from "./PromptComposer.module.css";

// Phase 4a: the real chat composer, bound to the send API. Structure/interaction
// follow beautifului's PromptBar (auto-growing textarea + tactile send button);
// the skin is DSH tokens via the bridge. This v1 is a textarea (not CodeMirror
// yet) with: enter-to-send behavior (promptEnterBehavior), shell-mode hint
// (inputModes), per-session draft persistence (promptDraftStorage), and
// send / steer / stop wired to sessionsApi. Phase 4b adds model / thinking
// pickers and /command · @file · #model completions (useCompletions +
// AutocompleteMenu). Attachments land next.

export interface PromptComposerProps {
  sessionId: string;
  machineId: string;
  /** The session cwd, needed to build the SessionRef for completions. */
  cwd?: string;
  /** Project / workspace scope for @file completions. */
  projectId?: string;
  workspaceId?: string;
  /** True while a prompt request is in flight (disables + shows the spinner). */
  sending: boolean;
  /** The composer is disabled (no session / read-only). */
  disabled?: boolean;
  /** Steering is possible — a response is streaming and can be redirected. */
  canSteer?: boolean;
  /** History is compacting — new input is queued, not sent immediately. */
  isCompacting?: boolean;
  /** There is running work / a queue that Stop can clear. */
  canStop?: boolean;
  /** The session's current model + thinking level, for the compact status row. */
  model?: SessionModel;
  thinkingLevel?: string;
  availableThinkingLevels?: readonly string[];
  onSelectModel?: () => void;
  onSelectThinking?: () => void;
  onSend: (
    text: string,
    streamingBehavior?: "steer" | "followUp",
    attachments?: PromptAttachment[],
    delivery?: PromptAttachmentDelivery,
  ) => void;
  onStop?: () => void;
}

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 200;

function draftKey(machineId: string, sessionId: string): string | undefined {
  if (machineId === "" || sessionId === "") return undefined;
  return machineSessionKey(machineId, sessionId);
}

function fileExtensionLabel(name: string): string {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex >= 0 && dotIndex < trimmed.length - 1) return trimmed.slice(dotIndex + 1, dotIndex + 5).toUpperCase();
  return "FILE";
}

export function PromptComposer({
  sessionId,
  machineId,
  cwd,
  projectId,
  workspaceId,
  sending,
  disabled = false,
  canSteer = false,
  isCompacting = false,
  canStop = false,
  model,
  thinkingLevel,
  availableThinkingLevels = [],
  onSelectModel,
  onSelectThinking,
  onSend,
  onStop,
}: PromptComposerProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>({ kind: "normal" });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef(createMobilePromptEnterMedia());

  const key = draftKey(machineId, sessionId);

  const completionRef = useMemo<SessionRef | undefined>(
    () => (cwd === undefined ? undefined : { id: sessionId, cwd }),
    [sessionId, cwd],
  );
  const completions = useCompletions(
    useMemo(
      () => ({ ref: completionRef, machineId, projectId, workspaceId }),
      [completionRef, machineId, projectId, workspaceId],
    ),
  );
  const attachments = useAttachments(key);

  // Load the persisted draft when the active session changes.
  useEffect(() => {
    const stored = key !== undefined ? loadDraft(key) : "";
    setDraft(stored);
    setInputMode(inputModeForDraft(stored));
    completions.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-grow the textarea to fit its content, up to a compact maximum.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.style.height = "0px";
    const next = Math.min(Math.max(input.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    input.style.height = `${String(next)}px`;
    input.style.overflowY = input.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [draft]);

  const busy = disabled || sending;
  const queuesInput = canSteer || isCompacting;
  const shellMode = inputMode.kind === "shell";

  const applyDraft = (value: string, cursor?: number): void => {
    setDraft(value);
    setInputMode(inputModeForDraft(value));
    if (key !== undefined) saveDraft(key, value);
    completions.refresh(value, cursor ?? value.length);
  };

  const send = (streamingBehavior?: "steer" | "followUp"): void => {
    if (busy) return;
    const text = draft.trim();
    const pending = attachments.attachments;
    if (text === "" && pending.length === 0) return;
    const behavior = queuesInput ? streamingBehavior : undefined;
    const promptAttachments = pending.length > 0 ? attachments.toPromptAttachments() : undefined;
    const delivery = attachments.effectiveDelivery;
    // Clear the composer before handing off; sending is owned by the caller.
    setDraft("");
    setInputMode({ kind: "normal" });
    completions.clear();
    attachments.clear();
    if (key !== undefined) clearDraft(key);
    onSend(text, behavior, promptAttachments, promptAttachments === undefined ? undefined : delivery);
  };

  // Insert a completion into the draft at its replace range, mirroring the
  // legacy PromptEditor.pick: append a trailing space unless the insertion is a
  // directory / positions the cursor mid-token, and swallow an existing closing
  // quote so quoted paths don't double up.
  const pick = (item: CompletionItem): void => {
    const suffix = item.kind === "file" && (item.insertText.endsWith("/") || item.cursorOffset !== undefined) ? "" : " ";
    const replaceTo =
      item.insertText.endsWith('"') && draft.slice(item.replaceTo).startsWith('"') ? item.replaceTo + 1 : item.replaceTo;
    const next = `${draft.slice(0, item.replaceFrom)}${item.insertText}${suffix}${draft.slice(replaceTo)}`;
    const cursor = item.replaceFrom + (item.cursorOffset ?? item.insertText.length) + suffix.length;
    applyDraft(next, cursor);
    completions.clear();
    const input = inputRef.current;
    if (input !== null) {
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(cursor, cursor);
      });
    }
  };

  const hasCompletions = completions.items.length > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (hasCompletions) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        completions.move(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        completions.move(-1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        completions.clear();
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing)) {
        const item = completions.items[completions.selectedIndex];
        if (item !== undefined) {
          event.preventDefault();
          pick(item);
          return;
        }
      }
    }
    if (event.key !== "Enter") return;
    if (event.nativeEvent.isComposing) return;
    if (!shouldSendPromptOnEnterShortcut(event.shiftKey, mediaRef.current, readPromptEnterPreference())) {
      return; // let the newline through
    }
    event.preventDefault();
    send(queuesInput ? "followUp" : undefined);
  };

  const onSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>): void => {
    completions.refresh(draft, event.currentTarget.selectionStart);
  };

  const addFilesFromDataTransfer = (data: DataTransfer | null): boolean => {
    if (data === null) return false;
    const files = Array.from(data.files);
    if (files.length === 0) return false;
    void attachments.addFiles(files);
    return true;
  };

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    if (addFilesFromDataTransfer(event.clipboardData)) event.preventDefault();
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    const data = event.dataTransfer;
    const hasFiles =
      Array.from(data.items).some((item) => item.kind === "file") || Array.from(data.types).includes("Files");
    if (hasFiles) event.preventDefault();
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    if (addFilesFromDataTransfer(event.dataTransfer)) event.preventDefault();
  };

  const canSend = (draft.trim().length > 0 || attachments.attachments.length > 0) && !busy;
  const canUseInlineDelivery = promptAttachmentsCanUseInlineDelivery(attachments.attachments);

  const gauge = thinkingGauge(thinkingLevel, availableThinkingLevels);
  const modelLabel =
    model === undefined
      ? "无模型"
      : `${model.provider !== undefined && model.provider !== "" ? `${model.provider}/` : ""}${model.id ?? "无模型"}`;

  return (
    <div className={clsx(styles.root, shellMode && styles.shellMode)}>
      {(onSelectModel !== undefined || onSelectThinking !== undefined) && (
        <div className={styles.compactStatus} aria-label="会话状态">
          {onSelectModel !== undefined && (
            <button type="button" className={styles.selectModel} title="选择模型" onClick={onSelectModel}>
              {modelLabel}
            </button>
          )}
          {onSelectThinking !== undefined && (
            <button
              type="button"
              className={styles.selectThinking}
              title={`思考级别：${thinkingLevelLabel(thinkingLevel)}`}
              aria-label={`思考级别：${thinkingLevelLabel(thinkingLevel)}`}
              onClick={onSelectThinking}
            >
              <span className={styles.gauge} aria-hidden="true">
                {Array.from({ length: gauge.total }, (_, i) => (
                  <span key={i} className={clsx(styles.gaugeBar, i < gauge.filled && styles.gaugeBarFilled)} />
                ))}
              </span>
            </button>
          )}
        </div>
      )}
      {shellMode && (
        <div className={styles.hint}>
          Shell 命令{inputMode.excludeFromContext ? " · 已排除出上下文" : ""}
        </div>
      )}
      {isCompacting && !shellMode && (
        <div className={styles.hint}>正在压缩历史 · 消息将进入队列</div>
      )}
      <div className={styles.composerWrap} onDragOver={onDragOver} onDrop={onDrop}>
        <AutocompleteMenu items={completions.items} selectedIndex={completions.selectedIndex} onPick={pick} />
        {(attachments.attachments.length > 0 || attachments.error !== undefined) && (
          <div className={styles.attachments} aria-label="待发送附件">
            {attachments.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={clsx(styles.chip, isInlinePromptAttachment(attachment) ? styles.chipImage : styles.chipFile)}
                title={attachment.name}
              >
                {isInlinePromptAttachment(attachment) ? (
                  <img
                    className={styles.chipImagePreview}
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                    alt={attachment.name}
                  />
                ) : (
                  <>
                    <span className={styles.chipExt} aria-hidden="true">
                      {fileExtensionLabel(attachment.name)}
                    </span>
                    <span className={styles.chipName}>{attachment.name}</span>
                  </>
                )}
                <button
                  type="button"
                  className={styles.chipRemove}
                  title="移除附件"
                  aria-label={`移除 ${attachment.name}`}
                  onClick={() => { attachments.remove(attachment.id); }}
                >
                  ×
                </button>
              </div>
            ))}
            {attachments.attachments.length > 0 && (
              <label
                className={styles.delivery}
                title={
                  canUseInlineDelivery
                    ? "附件如何传递给智能体"
                    : "普通文件将被保存并从工作区引用"
                }
              >
                <select
                  value={attachments.effectiveDelivery}
                  onChange={(event) =>
                    { attachments.changeDelivery(event.target.value === "folder" ? "folder" : "inline"); }
                  }
                >
                  <option value="inline" disabled={!canUseInlineDelivery}>
                    附加到消息{canUseInlineDelivery ? "" : "（仅图片）"}
                  </option>
                  <option value="folder">保存到 .pi-web/attachments</option>
                </select>
              </label>
            )}
            {attachments.error !== undefined && <div className={styles.attachmentError}>{attachments.error}</div>}
          </div>
        )}
        <div className={styles.composer}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const files = event.target.files === null ? [] : Array.from(event.target.files);
              event.target.value = "";
              if (files.length > 0) void attachments.addFiles(files);
            }}
          />
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => { applyDraft(event.target.value, event.target.selectionStart); }}
            onKeyDown={onKeyDown}
            onSelect={onSelect}
            onPaste={onPaste}
            onBlur={() => { completions.clear(); }}
            placeholder="输入消息…  （↵ 发送 · ⇧↵ 换行 · / 命令 · @ 引用文件）"
            aria-label="给 pi 发送消息"
            className={styles.textarea}
          />
          {/* Bottom action bar (mockup .composerBar): attach on the left, send /
              steer / stop grouped on the right, separated by a flexible spacer. */}
          <div className={styles.composerBar}>
            <button
              type="button"
              disabled={busy}
              title="添加附件"
              aria-label="添加附件"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(styles.iconBtn, styles.attachBtn)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <span className={styles.barSpacer} />
            <div className={styles.actions}>
              <button
                type="button"
                disabled={!canSend}
                title={queuesInput ? "排队等待当前活动结束" : "发送消息"}
                aria-label={queuesInput ? "消息入队" : "发送消息"}
                onClick={() => { send("followUp"); }}
                className={clsx(styles.iconBtn, styles.sendBtn)}
              >
                {sending ? (
                  <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 3a9 9 0 1 0 9 9" />
                  </svg>
                ) : queuesInput ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
              {canSteer && !isCompacting && (
                <button
                  type="button"
                  disabled={!canSend}
                  title="在下一次模型调用前引导当前回复"
                  aria-label="引导当前回复"
                  onClick={() => { send("steer"); }}
                  className={clsx(styles.iconBtn, styles.steerBtn)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                disabled={disabled || !canStop}
                title={canStop ? "停止当前工作并清空排队消息" : "无运行中任务"}
                aria-label="停止当前工作"
                onClick={() => onStop?.()}
                className={clsx(styles.iconBtn, styles.stopBtn)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
