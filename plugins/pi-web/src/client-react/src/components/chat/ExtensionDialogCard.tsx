import { type JSX, useEffect, useRef, useState } from "react";
import {
  EXTENSION_DIALOG_INPUT_MAX_LENGTH,
  type ExtensionDialogAnswer,
  type PendingExtensionDialog,
} from "@shared/apiTypes";
import styles from "./ExtensionDialogCard.module.css";

// Phase 4b: one open extension dialog (ctx.ui.confirm / select / input), data-
// bound. Ports the legacy ExtensionDialogCard open-mode interaction — the three
// dialog kinds, an in-flight close guard, and the display-only auto-cancel
// countdown — into React on the DSH skin. The daemon owns whether the dialog is
// open; the settled/closed record is a read-path concern.

const COUNTDOWN_TICK_MS = 1_000;

/** Remaining-time label for an open dialog's auto-cancel deadline (display only). */
export function extensionDialogCountdownText(timeoutAt: string | undefined, nowMs: number): string | undefined {
  if (timeoutAt === undefined) return undefined;
  const deadline = Date.parse(timeoutAt);
  if (!Number.isFinite(deadline)) return undefined;
  const remainingMs = deadline - nowMs;
  if (remainingMs <= 0) return "即将自动取消";
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours)} 小时 ${String(minutes)} 分后自动取消`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes)} 分 ${String(seconds % 60)} 秒后自动取消`;
  }
  return `${String(seconds)} 秒后自动取消`;
}

export interface ExtensionDialogCardProps {
  dialog: PendingExtensionDialog;
  onAnswer: (dialogId: string, value: ExtensionDialogAnswer) => void | Promise<void>;
  onCancel: (dialogId: string) => void | Promise<void>;
}

export function ExtensionDialogCard({ dialog, onAnswer, onCancel }: ExtensionDialogCardProps): JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const closingRef = useRef(false);

  // Reset local state when the dialog identity (by id) changes; a status refresh
  // re-projects the same open dialog and must not wipe a half-typed input.
  useEffect(() => {
    setInputValue("");
    setClosing(false);
    closingRef.current = false;
  }, [dialog.dialogId]);

  // Tick the display-only countdown while a timeout is pending.
  useEffect(() => {
    if (dialog.timeoutAt === undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => { setNow(Date.now()); }, COUNTDOWN_TICK_MS);
    return () => { window.clearInterval(timer); };
  }, [dialog.timeoutAt]);

  const closeWith = (close: () => void | Promise<void>): void => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    void Promise.resolve()
      .then(close)
      .catch(() => {
        // The controller owns the visible transport error; keep the card usable.
      })
      .finally(() => {
        closingRef.current = false;
        setClosing(false);
      });
  };

  const answer = (value: ExtensionDialogAnswer): void => { closeWith(() => onAnswer(dialog.dialogId, value)); };
  const cancel = (): void => { closeWith(() => onCancel(dialog.dialogId)); };

  const countdown = extensionDialogCountdownText(dialog.timeoutAt, now);

  return (
    <article className={styles.card} aria-labelledby="extension-dialog-heading">
      <header className={styles.header}>
        <h2 id="extension-dialog-heading" className={styles.title}>
          {dialog.title}
        </h2>
        {countdown !== undefined && <span className={styles.countdown}>{countdown}</span>}
      </header>
      {dialog.kind === "select" ? (
        <>
          <div className={styles.options} role="group" aria-label="选项">
            {(dialog.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.optionButton}
                disabled={closing}
                onClick={() => { answer(option); }}
              >
                {option}
              </button>
            ))}
          </div>
          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryAction} disabled={closing} onClick={cancel}>
              取消
            </button>
          </footer>
        </>
      ) : dialog.kind === "input" ? (
        <form
          className={styles.inputForm}
          onSubmit={(event) => {
            event.preventDefault();
            answer(inputValue);
          }}
        >
          <input
            className={styles.input}
            type="text"
            name="dialog-answer"
            aria-label="你的回答"
            placeholder={dialog.placeholder}
            maxLength={EXTENSION_DIALOG_INPUT_MAX_LENGTH}
            value={inputValue}
            disabled={closing}
            onChange={(event) => { setInputValue(event.target.value); }}
          />
          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryAction} disabled={closing} onClick={cancel}>
              取消
            </button>
            <button type="submit" className={styles.primaryAction} disabled={closing}>
              {closing ? "发送中…" : "发送"}
            </button>
          </footer>
        </form>
      ) : (
        <>
          {dialog.message !== undefined && <p className={styles.message}>{dialog.message}</p>}
          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryAction} disabled={closing} onClick={cancel}>
              取消
            </button>
            <button type="button" className={styles.secondaryAction} disabled={closing} onClick={() => { answer(false); }}>
              否
            </button>
            <button type="button" className={styles.primaryAction} disabled={closing} onClick={() => { answer(true); }}>
              是
            </button>
          </footer>
        </>
      )}
    </article>
  );
}
