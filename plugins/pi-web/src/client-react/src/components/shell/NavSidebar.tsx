import { type JSX, useEffect } from "react";
import clsx from "clsx";
import { formatSessionModified } from "../../state/sessionsTableModel";
import { useAppState } from "../../state/appStore";
import { useController } from "../../state/AppProvider";
import { useRoute } from "../../state/useRoute";
import styles from "./NavSidebar.module.css";

// DSH sidebar (authoritative mockup): logoRow (π brandMark + wordmark + collapse)
// → New-chat pill → scrollable nav groups (Projects, Sessions) → machineChip
// footer. Bound to real pi-web state: projects/sessions from the store, picking
// a project cascades selectProject + URL, picking a session round-trips the URL,
// New chat clears the session. Structure/skin match the mockup; labels stay in
// the app's existing English to match the rest of the chrome.

function sessionLabel(name: string | undefined, firstMessage: string, id: string): string {
  const trimmed = (name ?? firstMessage).trim();
  return trimmed === "" ? id : trimmed;
}

export function NavSidebar(): JSX.Element {
  const state = useAppState();
  const controller = useController();
  const { route, navigate } = useRoute();

  // Load sessions whenever the selected workspace changes.
  const workspacePath = state.selectedWorkspace?.path;
  useEffect(() => {
    if (workspacePath !== undefined) void controller.loadSessions(workspacePath);
  }, [controller, workspacePath]);

  const machine = state.selectedMachine;
  const activeProjectId = state.selectedProject?.id ?? route.projectId;

  const onProject = (id: string): void => {
    navigate({ projectId: id, workspaceId: undefined, sessionId: undefined });
    void controller.selectProject(id);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <div className={styles.brandIdentity}>
          <div className={styles.brandMark}>π</div>
          <div className={styles.brandName}>pi&#8209;web</div>
        </div>
        <button type="button" className={styles.iconButton} title="收起侧栏" aria-label="收起侧栏">
          ‹
        </button>
      </div>

      <button
        type="button"
        className={styles.newSession}
        onClick={() => { navigate({ sessionId: undefined, view: "chat" }); }}
        aria-label="新建会话"
      >
        <span aria-hidden="true">＋</span> 新建会话
      </button>

      <div className={styles.sidebarScroll}>
        {state.projects.length > 0 && (
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>项目</div>
            {state.projects.map((project) => {
              const count = state.workspacesByProjectId[project.id]?.length ?? 0;
              return (
                <button
                  type="button"
                  key={project.id}
                  className={clsx(styles.navItem, project.id === activeProjectId && styles.active)}
                  onClick={() => { onProject(project.id); }}
                >
                  <span className={styles.glyph} aria-hidden="true">
                    {project.id === activeProjectId ? "▸" : "▹"}
                  </span>
                  <span className={styles.navText}>{project.name}</span>
                  {count > 0 && <span className={styles.navMeta}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.navGroup}>
          <div className={styles.navGroupLabel}>会话</div>
          {state.sessions.length === 0 ? (
            <div className={styles.navEmpty}>暂无会话。</div>
          ) : (
            state.sessions.map((session) => {
              const active = session.id === route.sessionId;
              return (
                <button
                  type="button"
                  key={session.id}
                  className={clsx(styles.navItem, active && styles.active)}
                  onClick={() => { navigate({ sessionId: session.id, view: "chat" }); }}
                >
                  <span className={styles.dot} aria-hidden="true" data-active={active} />
                  <span className={styles.navText}>{sessionLabel(session.name, session.firstMessage, session.id)}</span>
                  <span className={styles.navMeta}>{formatSessionModified(session)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.footArea}>
        <div className={styles.machineChip}>
          <span className={styles.stateDot} aria-hidden="true" />
          <div className={styles.machineMeta}>
            <div className={styles.machineName}>{machine?.name ?? "local"}</div>
            <div className={styles.machineHost}>{machine === undefined ? "127.0.0.1:8504" : machine.id}</div>
          </div>
          <span className={styles.iconButton} aria-hidden="true">⚙</span>
        </div>
      </div>
    </aside>
  );
}
