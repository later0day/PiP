import clsx from "clsx";
import type {JSX, ReactNode } from "react";
import styles from "./ValuePill.module.css";

// ValuePill — a small numeric/value pill with an optional tone. Reconstructed
// from usage (tone?: "green" | "red", children). Original ships minified.
export interface ValuePillProps {
  tone?: "green" | "red";
  children: ReactNode;
}

export function ValuePill({ tone, children }: ValuePillProps): JSX.Element {
  return <span className={clsx(styles.pill, tone === "green" && styles.green, tone === "red" && styles.red)}>{children}</span>;
}
