import { type JSX, useEffect, useState } from "react";
import clsx from "clsx";
import { thinkingLevelLabel } from "@shared/thinkingLevels";
import { useAppState, useSetState } from "../../state/appStore";
import { useController } from "../../state/AppProvider";
import { useRoute } from "../../state/useRoute";
import { useActions } from "../../state/useActions";
import { ProjectDialog } from "../overlays/ProjectDialog";
import { MachineDialog, type MachineDialogSubmit } from "../overlays/MachineDialog";
import { ThemePicker } from "../overlays/ThemePicker";
import { ActionPalette } from "../overlays/ActionPalette";
import { SettingsDialog } from "../overlays/SettingsDialog";
import { SessionCleanupDialog } from "../overlays/SessionCleanupDialog";
import { SessionsTable } from "../overlays/SessionsTable";
import { SessionTreeView } from "../overlays/SessionTreeView";
import { AuthDialog } from "../overlays/AuthDialog";
import { useSessionCleanup } from "../../state/useSessionCleanup";
import { useAuth } from "../../state/useAuth";
import { useSettingsRoute } from "../../state/useSettingsRoute";
import styles from "./ContextBar.module.css";

// Phase 2d: machine → project → workspace breadcrumb selectors. Each selection
// writes the URL (useRoute) and triggers the next level's load through the
// controller. State selections are reconciled from the route so a deep link
// (?machine=&project=&workspace=&session=) resolves on load.
// Phase 6a: the bar also hosts the add-project / add-machine / appearance
// triggers and mounts their overlays (open state lives in AppState).
// Phase 6b: the command palette (Cmd/Ctrl-K) mounts here too, sourcing real
// actions from useActions.

// Map backend thinking-level wire values to the mockup's Chinese labels without
// touching the shared contract (thinkingLevelLabel stays the source of truth).
const THINKING_LABELS: Record<string, string> = {
  off: "关闭",
  low: "低",
  medium: "中",
  high: "高",
};

function thinkingLabelZh(level: string | undefined): string {
  const label = thinkingLevelLabel(level);
  return THINKING_LABELS[label] ?? label;
}

export function ContextBar(): JSX.Element {
  const state = useAppState();
  const setState = useSetState();
  const controller = useController();
  const { route, navigate } = useRoute();
  const [themeOpen, setThemeOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [machineError, setMachineError] = useState("");
  const cleanup = useSessionCleanup();
  const auth = useAuth();
  const actions = useActions({
    onOpenTheme: () => { setThemeOpen(true); },
    onOpenCleanup: cleanup.openDialog,
    onOpenSessions: () => { setSessionsOpen(true); },
    onLogin: () => { auth.openLogin(); },
    onLogout: () => { auth.openLogout(); },
  });
  const settingsRoute = useSettingsRoute();

  const machineId = state.selectedMachine?.id ?? route.machineId ?? "local";

  // Cmd/Ctrl-K opens the command palette (unless a text field owns the key or a
  // modal is already up).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setState({ actionPaletteOpen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [setState]);

  // Reconcile machine selection from the route once machines are loaded.
  useEffect(() => {
    if (state.machines.length === 0) return;
    const wanted = route.machineId ?? "local";
    if (state.selectedMachine?.id === wanted) return;
    void controller.selectMachine(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/state read fresh
  }, [route.machineId, state.machines, state.selectedMachine]);

  // Reconcile project selection + cascade workspaces.
  useEffect(() => {
    if (route.projectId === undefined) return;
    if (state.selectedProject?.id === route.projectId) return;
    if (state.projects.find((p) => p.id === route.projectId) === undefined) return;
    void controller.selectProject(route.projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/state read fresh
  }, [route.projectId, state.projects, state.selectedProject]);

  // Reconcile workspace selection + load its sessions.
  useEffect(() => {
    if (route.workspaceId === undefined) return;
    if (state.selectedWorkspace?.id === route.workspaceId) return;
    if (state.workspaces.find((w) => w.id === route.workspaceId) === undefined) return;
    void controller.selectWorkspace(route.workspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/state read fresh
  }, [route.workspaceId, state.workspaces, state.selectedWorkspace]);

  const onMachine = (id: string): void => {
    navigate({ machineId: id === "local" ? undefined : id, projectId: undefined, workspaceId: undefined, sessionId: undefined });
    void controller.selectMachine(id);
  };

  const onProject = (id: string): void => {
    navigate({ projectId: id, workspaceId: undefined, sessionId: undefined });
    void controller.selectProject(id);
  };

  const onWorkspace = (id: string): void => {
    navigate({ workspaceId: id, sessionId: undefined });
    void controller.selectWorkspace(id);
  };

  const onSubmitMachine = async (input: MachineDialogSubmit): Promise<void> => {
    setMachineError("");
    try {
      await controller.addMachine(input);
      navigate({ machineId: undefined, projectId: undefined, workspaceId: undefined, sessionId: undefined });
    } catch (error) {
      setMachineError(error instanceof Error ? error.message : String(error));
    }
  };

  // Mockup topbar (.topbar): a title + subtitle-breadcrumb on the left, model /
  // thinking pills on the right. The title is the active session/workspace; the
  // subtitle traces machine · project · workspace. The functional selectors stay
  // (tests + navigation depend on them) but ride the subtitle row as inline
  // controls rather than a labeled breadcrumb.
  const machineName = state.selectedMachine?.name ?? machineId;
  const status = state.status;
  const model = status?.model;
  const modelLabel =
    model === undefined
      ? undefined
      : `${model.provider !== undefined && model.provider !== "" ? `${model.provider}/` : ""}${model.id ?? "model"}`;
  const title =
    state.selectedSession?.name ??
    (state.selectedSession?.firstMessage !== undefined && state.selectedSession.firstMessage !== ""
      ? state.selectedSession.firstMessage
      : undefined) ??
    state.selectedWorkspace?.label ??
    "新建会话";

  return (
    <div className={styles.bar} role="navigation" aria-label="上下文">
      <div className={styles.heading}>
        <div className={styles.title}>{title}</div>
        <div className={styles.sub}>
          <div className={styles.group}>
            <select
              className={styles.select}
              value={state.selectedMachine?.id ?? "local"}
              onChange={(e) => { onMachine(e.target.value); }}
              aria-label="选择机器"
            >
              {state.machines.length === 0 && <option value="local">local</option>}
              {state.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                setMachineError("");
                setState({ machineDialogOpen: true });
              }}
              aria-label="添加机器"
              title="添加机器"
            >
              +
            </button>
          </div>

          <span className={styles.sep}>·</span>

          <div className={styles.group}>
            <select
              className={styles.select}
              value={route.projectId ?? ""}
              onChange={(e) => { onProject(e.target.value); }}
              aria-label="选择项目"
              disabled={state.projects.length === 0}
            >
              <option value="" disabled>
                {state.isLoadingProjects ? "加载中…" : "选择项目"}
              </option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => { setState({ projectDialogOpen: true }); }}
              aria-label="添加项目"
              title="添加项目"
            >
              +
            </button>
          </div>

          <span className={styles.sep}>·</span>

          <div className={styles.group}>
            <select
              className={styles.select}
              value={route.workspaceId ?? ""}
              onChange={(e) => { onWorkspace(e.target.value); }}
              aria-label="选择工作区"
              disabled={state.workspaces.length === 0}
            >
              <option value="" disabled>
                {state.isLoadingWorkspaces ? "加载中…" : "选择工作区"}
              </option>
              {state.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.spacer} />
      {state.error !== "" && <span className={styles.error}>{state.error}</span>}
      {modelLabel !== undefined && (
        <span className={clsx(styles.pill, styles.pillAccent)} title={`机器：${machineName}`}>
          <span aria-hidden="true">◆</span> {modelLabel}
        </span>
      )}
      {status?.thinkingLevel !== undefined && (
        <span className={styles.pill}>思考: {thinkingLabelZh(status.thinkingLevel)}</span>
      )}
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => { setState({ actionPaletteOpen: true }); }}
        aria-label="命令面板"
        title="命令面板 (⌘K)"
      >
        ⌘
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => { setThemeOpen(true); }}
        aria-label="外观"
        title="外观"
      >
        ◑
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => { settingsRoute.open("general"); }}
        aria-label="设置"
        title="设置"
      >
        ⚙
      </button>

      {state.projectDialogOpen && (
        <ProjectDialog
          machineId={machineId}
          onSubmit={(path, create, trust) => {
            void controller.addProject(path, create, trust, machineId).then((projectId) => {
              if (projectId !== undefined) {
                navigate({ projectId, workspaceId: undefined, sessionId: undefined });
              }
            });
          }}
          onCancel={() => { setState({ projectDialogOpen: false }); }}
        />
      )}
      {state.machineDialogOpen && (
        <MachineDialog
          error={machineError}
          onSubmit={onSubmitMachine}
          onCancel={() => { setState({ machineDialogOpen: false }); }}
        />
      )}
      {themeOpen && <ThemePicker onClose={() => { setThemeOpen(false); }} />}
      {state.actionPaletteOpen && (
        <ActionPalette
          actions={actions}
          onRun={(action) => {
            setState({ actionPaletteOpen: false });
            void action.run();
          }}
          onCancel={() => { setState({ actionPaletteOpen: false }); }}
        />
      )}
      {settingsRoute.section !== undefined && (
        <SettingsDialog
          section={settingsRoute.section}
          actions={actions}
          onNavigate={(next) => { settingsRoute.navigate(next, { replace: true }); }}
          onClose={() => { settingsRoute.close(); }}
        />
      )}
      {cleanup.open && (
        <SessionCleanupDialog
          preview={cleanup.preview}
          previewRequest={cleanup.previewRequest}
          result={cleanup.result}
          loading={cleanup.loading}
          running={cleanup.running}
          error={cleanup.error}
          onPreview={cleanup.preview_}
          onRun={cleanup.run}
          onClose={cleanup.closeDialog}
        />
      )}
      {sessionsOpen && (
        <SessionsTable
          onPick={(sessionId) => { navigate({ sessionId, view: "chat" }); }}
          onClose={() => { setSessionsOpen(false); }}
        />
      )}
      {state.treeDialog !== undefined && (
        <SessionTreeView snapshot={state.treeDialog} onClose={() => { setState({ treeDialog: undefined }); }} />
      )}
      {auth.authDialog !== undefined && (
        <AuthDialog
          state={auth.authDialog}
          onChooseMethod={auth.chooseMethod}
          onSelectProvider={auth.selectProvider}
          onLogoutProvider={auth.logoutProvider}
          onOAuthInput={auth.updateOAuthInput}
          onOAuthRespond={auth.respondOAuth}
          onOAuthCancel={auth.cancelOAuth}
          onCancel={auth.closeDialog}
        />
      )}
    </div>
  );
}
