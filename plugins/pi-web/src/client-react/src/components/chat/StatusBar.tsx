import clsx from "clsx";
import type { JSX } from "react";
import { formatCost, formatTokenCount } from "@client/utils/format";
import type { SessionStatus } from "@shared/apiTypes";
import styles from "./StatusBar.module.css";

// Phase 4a: the session status bar (legacy StatusBar.ts). Reads tokens / cost /
// context usage / queued count from the live SessionStatus. Warning-tray toggle
// lands with the InsightCards tray in Phase 6; this v1 shows the metrics row.

export interface StatusBarProps {
  status: SessionStatus | undefined;
}

function contextText(status: SessionStatus): string {
  const context = status.contextUsage;
  if (context === undefined) return "上下文未知";
  if (context.percent == null) return `上下文 ${formatTokenCount(context.contextWindow)}`;
  return `${context.percent.toFixed(1)}%/${formatTokenCount(context.contextWindow)}`;
}

export function StatusBar({ status }: StatusBarProps): JSX.Element {
  if (status === undefined) {
    return <div className={clsx(styles.bar, styles.muted)}>暂无会话状态</div>;
  }
  return (
    <div className={styles.bar}>
      <span>↑{formatTokenCount(status.tokens.input)}</span>
      <span>↓{formatTokenCount(status.tokens.output)}</span>
      <span className={styles.context}>{contextText(status)}</span>
      <span>{formatCost(status.cost)}</span>
      {status.pendingMessageCount > 0 && <span>{status.pendingMessageCount} 条排队</span>}
      {status.isCompacting && <span className={styles.busy}>压缩中…</span>}
      {status.isStreaming && !status.isCompacting && <span className={styles.busy}>输出中…</span>}
    </div>
  );
}
