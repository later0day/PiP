import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { cssVars } from "../../lib/cssVars";
import styles from "./AppFrame.module.css";

// DSH AppFrame: a three-column grid (sidebar 260 · chat 1fr · workspace) on
// bg-base with hairline column dividers — NOT panels-on-canvas. The workspace
// column is resizable via a pointer-capture drag handle straddling its left
// divider; drags are rAF-throttled and pause transitions. Mobile (<=720px)
// collapses to a single-column tabbed layout.

const MIN_WORKSPACE = 280;
const MAX_WORKSPACE_FRACTION = 0.6;
const DEFAULT_WORKSPACE = 340;

export type MobileTab = "sidebar" | "chat" | "workspace";

export interface AppFrameProps {
  sidebar: ReactNode;
  chat: ReactNode;
  /** When present, the workspace panel is mounted (resizable). */
  workspace?: ReactNode;
}

export function AppFrame({ sidebar, chat, workspace }: AppFrameProps): JSX.Element {
  const [workspaceWidth, setWorkspaceWidth] = useState(DEFAULT_WORKSPACE);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<MobileTab>("chat");
  const frameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingWidth = useRef(workspaceWidth);

  const applyWidth = useCallback((clientX: number): void => {
    const frame = frameRef.current;
    if (frame === null) return;
    const rect = frame.getBoundingClientRect();
    // Workspace width = distance from pointer to the frame's right edge, clamped.
    const raw = rect.right - clientX;
    const max = rect.width * MAX_WORKSPACE_FRACTION;
    pendingWidth.current = Math.max(MIN_WORKSPACE, Math.min(max, raw));
    rafRef.current ??= window.requestAnimationFrame(() => {
      rafRef.current = null;
      setWorkspaceWidth(pendingWidth.current);
    });
  }, []);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [],
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragging) return;
      applyWidth(event.clientX);
    },
    [dragging, applyWidth],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const showWorkspace = workspace !== undefined && workspace !== null;

  return (
    <>
      <div
        ref={frameRef}
        className={clsx(styles.frame, !showWorkspace && styles.noWorkspace, dragging && styles.dragging)}
        style={cssVars({ "--ws-w": `${String(workspaceWidth)}px` })}
      >
        <div className={styles.sidebar} data-mobile-active={tab === "sidebar"}>
          {sidebar}
        </div>

        <div className={styles.chat} data-mobile-active={tab === "chat"}>
          {chat}
        </div>

        {showWorkspace && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整工作区面板宽度"
              className={clsx(styles.handle, dragging && styles.handleActive)}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            <div className={styles.workspace} data-mobile-active={tab === "workspace"}>
              {workspace}
            </div>
          </>
        )}
      </div>

      <nav className={styles.tabbar} aria-label="面板">
        <button
          type="button"
          className={clsx(styles.tab, tab === "sidebar" && styles.tabActive)}
          onClick={() => { setTab("sidebar"); }}
        >
          导航
        </button>
        <button
          type="button"
          className={clsx(styles.tab, tab === "chat" && styles.tabActive)}
          onClick={() => { setTab("chat"); }}
        >
          对话
        </button>
        {showWorkspace && (
          <button
            type="button"
            className={clsx(styles.tab, tab === "workspace" && styles.tabActive)}
            onClick={() => { setTab("workspace"); }}
          >
            工作区
          </button>
        )}
      </nav>
    </>
  );
}
