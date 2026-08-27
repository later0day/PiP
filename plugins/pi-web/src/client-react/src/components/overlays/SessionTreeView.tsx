import { type JSX, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ModalSurface } from "../../primitives";
import type { SessionTreeNodeKind, SessionTreeSnapshot } from "@shared/apiTypes";
import {
  buildSessionTreeModel,
  initialSessionTreeSelection,
  toggleSessionTreeFold,
  transitionSessionTreeKey,
  visibleSessionTreeRows,
  type SessionTreeKeyState,
  type SessionTreeRow,
} from "@client/sessionTreeModel";
import { cssVars } from "../../lib/cssVars";
import styles from "./SessionTreeView.module.css";

// SessionTreeView — Phase 6l. The read-only half of the beautifului #16
// (Flowchart / session-tree viz) bound to real data: the SessionTreeSnapshot
// that lands in state.treeDialog from a `/tree` slash-command result. Reuses the
// Lit-free, already-tested sessionTreeModel verbatim (build → visible rows →
// fold → roving keyboard nav → active-path/active-leaf derivation). Renders the
// navigator's tree step only — indented treeitem rows with a disclosure toggle,
// kind badges (tone-colored), and Active path / Active leaf markers. The
// fork/continue/summary mutation half is deferred (the plan marks #16 optional);
// this lands the real session-tree visualization without any mutating action.

// Kind → label + tone + bookkeeping. Inlined from the legacy navigator's
// SESSION_TREE_KIND_PRESENTATION so we import the Lit-free model, never the
// Lit-decorated component module.
type SessionTreeKindTone = "user" | "assistant" | "tool" | "shell" | "context" | "metadata";
interface KindPresentation {
  readonly label: string;
  readonly tone: SessionTreeKindTone;
  readonly bookkeeping: boolean;
}
const KIND_PRESENTATION: Record<SessionTreeNodeKind, KindPresentation> = {
  user: { label: "用户", tone: "user", bookkeeping: false },
  assistant: { label: "助手", tone: "assistant", bookkeeping: false },
  "tool-result": { label: "工具结果", tone: "tool", bookkeeping: false },
  bash: { label: "Shell", tone: "shell", bookkeeping: false },
  "custom-message": { label: "自定义消息", tone: "context", bookkeeping: false },
  compaction: { label: "压缩", tone: "context", bookkeeping: false },
  "branch-summary": { label: "分支摘要", tone: "context", bookkeeping: false },
  "model-change": { label: "模型", tone: "metadata", bookkeeping: true },
  "thinking-level-change": { label: "思考", tone: "metadata", bookkeeping: true },
  "session-info": { label: "会话信息", tone: "metadata", bookkeeping: true },
  label: { label: "标签", tone: "metadata", bookkeeping: true },
  custom: { label: "自定义", tone: "metadata", bookkeeping: true },
  other: { label: "其他", tone: "metadata", bookkeeping: true },
};
const MAX_VISUAL_DEPTH = 8;
function visualDepth(branchDepth: number): number {
  return Math.min(Math.max(0, branchDepth), MAX_VISUAL_DEPTH);
}

export interface SessionTreeViewProps {
  snapshot: SessionTreeSnapshot;
  onClose: () => void;
}

export function SessionTreeView({ snapshot, onClose }: SessionTreeViewProps): JSX.Element {
  const model = useMemo(() => buildSessionTreeModel(snapshot), [snapshot]);
  const [key, setKey] = useState<SessionTreeKeyState>(() => ({
    selectedId: initialSessionTreeSelection(model),
    foldedIds: new Set<string>(),
  }));

  // Re-seed the selection when the snapshot (and thus the model) changes.
  useEffect(() => {
    setKey({ selectedId: initialSessionTreeSelection(model), foldedIds: new Set<string>() });
  }, [model]);

  const rows = useMemo(() => visibleSessionTreeRows(model, key.foldedIds), [model, key.foldedIds]);
  const selectedRowRef = useRef<HTMLDivElement>(null);

  // Keep the roving-tabindex row focused as the selection moves.
  useEffect(() => {
    selectedRowRef.current?.focus();
  }, [key.selectedId, rows]);

  const onKeyDown = (event: ReactKeyboardEvent): void => {
    const transition = transitionSessionTreeKey(model, key, event.key);
    if (!transition.handled) return;
    event.preventDefault();
    if (transition.action === "cancel") {
      onClose();
      return;
    }
    // "confirm" (Enter) has no read-only effect here — selection already tracks.
    setKey({ selectedId: transition.selectedId, foldedIds: transition.foldedIds });
  };

  return (
    <ModalSurface onClose={onClose} label="会话历史" className={styles.surface}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <strong>会话历史</strong>
          <button type="button" className={styles.close} title="关闭" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <div className={styles.intro}>
          <p>此会话的完整历史，包括每一条分支。</p>
          <div className={styles.legend} aria-label="会话树标记">
            <span>
              <span className={clsx(styles.marker, styles.markerPath)} aria-hidden="true" />
              活动路径
            </span>
            <span>
              <span className={clsx(styles.marker, styles.markerLeaf)} aria-hidden="true" />
              活动叶节点
            </span>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className={styles.empty} role="status">
            此会话不包含任何可选的历史条目。
          </div>
        ) : (
          <div className={styles.tree} role="tree" aria-label="完整会话历史" onKeyDown={onKeyDown}>
            {rows.map((row) => (
              <TreeRow
                key={row.node.id}
                row={row}
                selected={row.node.id === key.selectedId}
                folded={key.foldedIds.has(row.node.id)}
                rowRef={row.node.id === key.selectedId ? selectedRowRef : undefined}
                onSelect={() => { setKey((current) => ({ ...current, selectedId: row.node.id })); }}
                onToggle={() => { setKey((current) => toggleSessionTreeFold(model, current, row.node.id)); }}
              />
            ))}
          </div>
        )}
      </div>
    </ModalSurface>
  );
}

interface TreeRowProps {
  row: SessionTreeRow;
  selected: boolean;
  folded: boolean;
  rowRef: React.Ref<HTMLDivElement> | undefined;
  onSelect: () => void;
  onToggle: () => void;
}

function TreeRow({ row, selected, folded, rowRef, onSelect, onToggle }: TreeRowProps): JSX.Element {
  const hasChildren = row.childIds.length > 0;
  const expanded = hasChildren && !folded;
  const presentation = KIND_PRESENTATION[row.node.kind];
  const depth = visualDepth(row.branchDepth);

  return (
    <div
      ref={rowRef}
      className={clsx(
        styles.row,
        selected && styles.rowSelected,
        row.activePath && styles.rowActivePath,
        row.activeLeaf && styles.rowActiveLeaf,
        presentation.bookkeeping && styles.rowBookkeeping,
      )}
      style={cssVars({ "--tree-indent": `${String(depth * 16)}px` })}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-current={row.activeLeaf ? "true" : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
    >
      <span
        className={clsx(styles.disclosure, !hasChildren && styles.disclosureLeaf)}
        title={!hasChildren ? "无子条目" : expanded ? "折叠分支" : "展开分支"}
        aria-hidden="true"
        onClick={(event) => {
          event.stopPropagation();
          if (hasChildren) onToggle();
        }}
      >
        {!hasChildren ? "·" : expanded ? "▾" : "▸"}
      </span>
      <span className={styles.metadata}>
        <span className={clsx(styles.kind, styles[`tone_${presentation.tone}`])}>{presentation.label}</span>
        <span className={styles.badges}>
          {row.activePath && !row.activeLeaf && <span className={clsx(styles.badge, styles.badgePath)}>活动路径</span>}
          {row.activeLeaf && <span className={clsx(styles.badge, styles.badgeLeaf)}>活动叶节点</span>}
        </span>
      </span>
      <span className={styles.entry}>
        <span className={styles.summary} dir="auto">
          {row.node.summary}
        </span>
        {row.node.label !== undefined && (
          <span className={styles.label} title={row.node.label}>
            {row.node.label}
          </span>
        )}
        {row.node.timestamp !== undefined && <time dateTime={row.node.timestamp}>{row.node.timestamp}</time>}
      </span>
    </div>
  );
}
