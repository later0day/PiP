import clsx from "clsx";
import { type JSX, useMemo, useState } from "react";
import { ModalSurface } from "../../primitives";
import type { CommandOption } from "@shared/apiTypes";
import styles from "./CommandPicker.module.css";

// CommandPicker — a searchable/selectable option list dialog (legacy
// CommandPicker.ts). Used for thinking-level selection and any generic pick
// list. DSH-skinned on ModalSurface; arrow-key navigation + Enter to pick.

export interface CommandPickerProps {
  title?: string;
  searchable?: boolean;
  options: CommandOption[];
  selectedValue?: string;
  onPick: (value: string) => void;
  onCancel: () => void;
}

export function CommandPicker({
  title = "选择",
  searchable = false,
  options,
  selectedValue,
  onPick,
  onCancel,
}: CommandPickerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === "") return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""} ${option.value}`.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  const initialIndex = Math.max(
    filtered.findIndex((option) => option.value === selectedValue),
    0,
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[selectedIndex];
      if (option !== undefined) onPick(option.value);
    }
  };

  return (
    <ModalSurface
      onClose={onCancel}
      initialFocus={searchable ? "input" : ".options"}
      label={title}
      className={styles.modal}
    >
      <div onKeyDown={onKeyDown} className={styles.body}>
        <header className={styles.header}>
          <strong>{title}</strong>
          <button type="button" aria-label="关闭" className={styles.close} onClick={onCancel}>
            ×
          </button>
        </header>
        {searchable && (
          <input
            className={styles.search}
            placeholder="搜索"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
          />
        )}
        <div className={clsx(styles.options, "options")} tabIndex={0}>
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={index === selectedIndex ? styles.selected : undefined}
              aria-current={index === selectedIndex ? "true" : undefined}
              onFocus={() => { setSelectedIndex(index); }}
              onMouseEnter={() => { setSelectedIndex(index); }}
              onClick={() => { onPick(option.value); }}
            >
              <span>{option.label}</span>
              {option.description !== undefined && option.description !== "" && (
                <small>{option.description}</small>
              )}
            </button>
          ))}
          {filtered.length === 0 && <div className={styles.empty}>无匹配选项</div>}
        </div>
      </div>
    </ModalSurface>
  );
}
