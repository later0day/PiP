import { type JSX, useState } from "react";
import clsx from "clsx";
import type { ToolExecutionPart } from "@client/components/shared";
import { countDiffLines, diffLineClass } from "./diffLines";
import styles from "./ToolExecutionCard.module.css";

// Phase 3a: real ToolExecutionCard (the beautifului ToolChips surface bound to
// live tool events). Ports the legacy ToolExecutionView structure — status
// header, +/- diff stats, collapsible diff/result body — onto DSH tokens.

const MAX_COLLAPSED_DIFF_LINES = 180;

export interface ToolExecutionCardProps {
  execution: ToolExecutionPart;
}

interface ToolTarget {
  label: "Command" | "File" | "Input";
  text: string;
}

// Display labels for the tool-target kind (the label field doubles as a
// discriminator, so it stays an English key and maps to Chinese here).
const TARGET_LABEL: Record<ToolTarget["label"], string> = {
  Command: "命令",
  File: "文件",
  Input: "输入",
};

export function ToolExecutionCard({ execution }: ToolExecutionCardProps): JSX.Element {
  const [showFullDiff, setShowFullDiff] = useState(false);

  const path = pathFromArgs(execution.args);
  const actualDiff = getString(execution.details, "diff");
  const visibleDiff = actualDiff ?? execution.preview?.diff;
  const diffStats = visibleDiff === undefined ? undefined : countDiffLines(visibleDiff);
  const previewMismatch =
    actualDiff !== undefined && execution.preview?.diff !== undefined && actualDiff !== execution.preview.diff;
  const errorText = execution.status === "error" ? execution.resultText : execution.preview?.error;
  const bodyText = visibleDiff === undefined ? execution.resultText : undefined;
  const target = toolTarget(execution, path);

  return (
    <section className={clsx(styles.card, styles[execution.status])}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.statusIcon} aria-hidden="true">
            {statusIcon(execution.status)}
          </span>
          <strong>{execution.toolName}</strong>
          {target !== undefined && (
            <span
              className={target.label === "File" ? styles.path : styles.summary}
              title={target.text}
              aria-label={`${TARGET_LABEL[target.label]}：${target.text}`}
            >
              {target.text}
            </span>
          )}
        </div>
        <div className={styles.meta}>
          {editCountLabel(execution) !== undefined && <span>{editCountLabel(execution)}</span>}
          {diffStats !== undefined && (
            <span className={styles.diffStats}>
              <b className={styles.added}>+{diffStats.added}</b>
              <span>/</span>
              <b className={styles.removed}>-{diffStats.removed}</b>
            </span>
          )}
          <span className={styles.statusLabel}>{statusLabel(execution.status)}</span>
        </div>
      </div>

      {previewMismatch && <p className={styles.notice}>应用的 diff 与预览不一致。</p>}
      {errorText !== undefined && errorText !== "" && <pre className={styles.errorText}>{errorText}</pre>}

      {visibleDiff === undefined ? (
        <TextBody text={bodyText} open={execution.status === "error"} target={target} />
      ) : (
        <DiffBody
          diff={visibleDiff}
          label={actualDiff === undefined ? "预览 diff" : "应用的 diff"}
          target={target}
          showFull={showFullDiff}
          onShowFull={() => { setShowFullDiff(true); }}
        />
      )}
    </section>
  );
}

function TextBody({ text, open, target }: { text: string | undefined; open: boolean; target: ToolTarget | undefined }): JSX.Element | null {
  if ((text === undefined || text === "") && target === undefined) return null;
  return (
    <details className={styles.textBody} open={open}>
      <summary>详情</summary>
      {target !== undefined && (
        <div className={styles.detailTarget}>
          <span className={styles.detailLabel}>{TARGET_LABEL[target.label]}</span>
          <pre className={styles.detailTargetValue}>{target.text}</pre>
        </div>
      )}
      {text !== undefined && text !== "" && (
        <div className={styles.detailResult}>
          <span className={styles.detailLabel}>结果</span>
          <pre>{text}</pre>
        </div>
      )}
    </details>
  );
}

function DiffBody({
  diff,
  label,
  target,
  showFull,
  onShowFull,
}: {
  diff: string;
  label: string;
  target: ToolTarget | undefined;
  showFull: boolean;
  onShowFull: () => void;
}): JSX.Element {
  const lines = diff.split("\n");
  const truncated = !showFull && lines.length > MAX_COLLAPSED_DIFF_LINES;
  const visibleLines = truncated ? lines.slice(0, MAX_COLLAPSED_DIFF_LINES) : lines;
  return (
    <details className={styles.diffDetails} open>
      <summary>
        <span>{label}</span>
        <small>
          {lines.length} 行
        </small>
      </summary>
      {target !== undefined && (
        <div className={styles.detailTarget}>
          <span className={styles.detailLabel}>{TARGET_LABEL[target.label]}</span>
          <pre className={styles.detailTargetValue}>{target.text}</pre>
        </div>
      )}
      <pre className={styles.diff} aria-label={label}>
        <code className={styles.diffContent}>
          {visibleLines.map((line, index) => (
            <span key={index} className={styles[diffLineClass(line)]}>
              {line}
            </span>
          ))}
        </code>
      </pre>
      {truncated && (
        <button className={styles.showMore} type="button" onClick={onShowFull}>
          显示全部 {lines.length} 行 diff
        </button>
      )}
    </details>
  );
}

function toolTarget(execution: ToolExecutionPart, path: string | undefined): ToolTarget | undefined {
  if (path !== undefined && path !== "") return { label: "File", text: path };
  const command = getString(execution.args, "command");
  if (command !== undefined && command !== "") return { label: "Command", text: command };
  if (execution.summary !== "") return { label: "Input", text: execution.summary };
  return undefined;
}

function pathFromArgs(args: unknown): string | undefined {
  return getString(args, "path") ?? getString(args, "file_path");
}

function editCountLabel(execution: ToolExecutionPart): string | undefined {
  if (execution.toolName !== "edit") return undefined;
  const edits = getProperty(execution.args, "edits");
  if (Array.isArray(edits)) return `${String(edits.length)} 处修改`;
  if (typeof getProperty(execution.args, "oldText") === "string" && typeof getProperty(execution.args, "newText") === "string") return "1 处修改";
  return undefined;
}

function statusIcon(status: ToolExecutionPart["status"]): string {
  if (status === "success") return "✓";
  if (status === "error") return "✖";
  if (status === "running") return "●";
  return "○";
}

function statusLabel(status: ToolExecutionPart["status"]): string {
  if (status === "success") return "完成";
  if (status === "error") return "失败";
  if (status === "running") return "运行中";
  return "等待中";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProperty(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function getString(value: unknown, key: string): string | undefined {
  const property = getProperty(value, key);
  return typeof property === "string" ? property : undefined;
}
