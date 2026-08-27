import clsx from "clsx";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import type { AppAction } from "@client/actions";
import { formatShortcut } from "@client/keyboardShortcuts";
import { ModalSurface } from "../../primitives";
import styles from "./ActionPalette.module.css";

// ActionPalette — the command palette overlay (legacy ActionPalette.ts, the
// SearchList acceptance component #15). A search field over a keyboard-navigable
// action list: ↑/↓ move a roving selection, Enter runs it, disabled actions stay
// visible with their reason. The pure filter is copied verbatim. DSH-skinned on
// ModalSurface.

export function filterActionPaletteActions(actions: readonly AppAction[], queryText: string): AppAction[] {
  const query = queryText.trim().toLowerCase();
  return actions
    .filter((action) => action.enabled !== false || action.disabledReason !== undefined)
    .filter((action) => {
      if (query === "") return true;
      const haystack = [
        action.title,
        action.description ?? "",
        action.disabledReason ?? "",
        action.group ?? "",
        action.shortcut ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
}

export interface ActionPaletteProps {
  actions: AppAction[];
  onRun: (action: AppAction) => void;
  onCancel: () => void;
}

export function ActionPalette({ actions, onRun, onCancel }: ActionPaletteProps): JSX.Element {
  const [queryText, setQueryText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = filterActionPaletteActions(actions, queryText);

  // Clamp the roving selection when the filtered list shrinks (matches legacy
  // updated()).
  useEffect(() => {
    const maxIndex = Math.max(0, filtered.length - 1);
    setSelectedIndex((current) => (current > maxIndex ? maxIndex : current));
  }, [filtered.length]);

  // Keep the selected row scrolled into view.
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const selected = list.querySelector<HTMLElement>('[aria-current="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const run = useCallback(
    (action: AppAction): void => {
      if (action.enabled === false) return;
      onRun(action);
    },
    [onRun],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      // Let native activation controls (focused buttons) own their own keys.
      const target = event.target;
      const onControl = target instanceof HTMLButtonElement && target !== document.activeElement;
      if (onControl) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (filtered.length > 0) setSelectedIndex((current) => (current + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (filtered.length > 0) setSelectedIndex((current) => (current - 1 + filtered.length) % filtered.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const action = filtered[selectedIndex];
        if (action !== undefined) run(action);
      }
    },
    [filtered, selectedIndex, run],
  );

  return (
    <ModalSurface
      onClose={onCancel}
      initialFocus="input"
      label="命令面板"
      className={styles.surface}
    >
      <div onKeyDown={onKeyDown} className={styles.inner}>
        <header className={styles.header}>
          <input
            className={styles.input}
            value={queryText}
            placeholder="搜索操作…"
            onChange={(event) => {
              setQueryText(event.target.value);
              setSelectedIndex(0);
            }}
          />
          <button type="button" className={styles.close} onClick={onCancel} aria-label="关闭" title="关闭">
            ×
          </button>
        </header>
        <div className={styles.options} ref={listRef}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>未找到操作。</div>
          ) : (
            filtered.map((action, index) => {
              const selected = index === selectedIndex;
              const disabled = action.enabled === false;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={disabled}
                  title={action.disabledReason ?? action.title}
                  aria-current={selected ? "true" : undefined}
                  className={clsx(styles.option, selected && styles.selected, disabled && styles.disabled)}
                  onMouseEnter={() => { setSelectedIndex(index); }}
                  onClick={() => { run(action); }}
                >
                  <span className={styles.main}>
                    <strong>{action.title}</strong>
                    {action.description !== undefined && action.description !== "" ? (
                      <small>{action.description}</small>
                    ) : null}
                    {disabled && action.disabledReason !== undefined ? (
                      <small className={styles.disabledReason}>{action.disabledReason}</small>
                    ) : null}
                  </span>
                  {action.shortcut !== undefined ? <kbd className={styles.kbd}>{formatShortcut(action.shortcut)}</kbd> : null}
                  {action.group !== undefined && action.group !== "" ? (
                    <small className={styles.group}>{action.group}</small>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </ModalSurface>
  );
}
