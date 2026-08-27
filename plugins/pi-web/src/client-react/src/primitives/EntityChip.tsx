import type { JSX } from "react";
import styles from "./EntityChip.module.css";

// EntityChip — an inline @mention entity pill with a colored initial avatar.
// Reconstructed from usage (single `name` prop). Original ships minified.
export interface EntityChipProps {
  name: string;
}

export function EntityChip({ name }: EntityChipProps): JSX.Element {
  return (
    <span className={styles.chip}>
      <span className={styles.avatar}>{(name || "?")[0]}</span>
      {name}
    </span>
  );
}
