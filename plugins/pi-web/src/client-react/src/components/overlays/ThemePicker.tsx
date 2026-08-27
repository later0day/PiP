import { type JSX, useState } from "react";
import { ModalSurface } from "../../primitives";
import { applyChoice, currentChoice, type ThemeChoice } from "../../theme/bootTheme";
import styles from "./ThemePicker.module.css";

// ThemePicker — the appearance selector (Auto / Light / Dark) on ModalSurface.
// Applies immediately on pick (so the change previews live behind the dialog),
// persisting through bootTheme's storage seam; Done closes. DSH-skinned.

interface ThemeOption {
  value: ThemeChoice;
  label: string;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "auto", label: "自动", description: "跟随系统外观" },
  { value: "dsh-light", label: "浅色", description: "始终使用浅色主题" },
  { value: "dsh-dark", label: "深色", description: "始终使用深色主题" },
];

export interface ThemePickerProps {
  onClose: () => void;
}

export function ThemePicker({ onClose }: ThemePickerProps): JSX.Element {
  const [choice, setChoice] = useState<ThemeChoice>(() => currentChoice());

  const pick = (value: ThemeChoice): void => {
    setChoice(value);
    applyChoice(value);
  };

  return (
    <ModalSurface onClose={onClose} label="外观" className={styles.surface}>
      <header className={styles.header}>
        <strong>外观</strong>
        <button type="button" className={styles.close} onClick={onClose} aria-label="关闭">
          ×
        </button>
      </header>
      <div className={styles.body} role="radiogroup" aria-label="主题">
        {THEME_OPTIONS.map((option) => {
          const selected = option.value === choice;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? styles.optionSelected : styles.option}
              onClick={() => { pick(option.value); }}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              <span className={styles.optionDescription}>{option.description}</span>
              {selected ? <span className={styles.optionCheck} aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
      <footer className={styles.footer}>
        <button type="button" className={styles.primary} onClick={onClose}>
          完成
        </button>
      </footer>
    </ModalSurface>
  );
}
