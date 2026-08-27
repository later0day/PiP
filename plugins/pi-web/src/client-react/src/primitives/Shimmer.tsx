import type {JSX, ReactNode } from "react";
import clsx from "clsx";
import styles from "./Shimmer.module.css";

// Shimmer — a gradient text-mask that sweeps left-to-right (shimmer-text
// keyframe). Rebuilt behavior-equivalent from usage (className, children).
export interface ShimmerProps {
  className?: string;
  children: ReactNode;
}

export function Shimmer({ className, children }: ShimmerProps): JSX.Element {
  return (
    <span className={clsx(styles.shimmer, className)}>{children}</span>
  );
}
