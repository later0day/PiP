import { type JSX, createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { initialAppState, resetWorkspaceScopedState, type AppState } from "@client/appState";
import { machinesApi, projectsApi, sessionsApi, trustApi, workspacesApi } from "@api/clients";
import { fileCompletionInsertText } from "@client/promptCompletions";
import type {
  AskUserSubmission,
  ExtensionDialogAnswer,
  PromptAttachment,
  PromptAttachmentDelivery,
  SessionRef,
} from "@shared/apiTypes";
import {
  AppDispatchContext,
  AppStateContext,
  appReducer,
  type AppAction,
  type AppStatePatch,
} from "./appStore";

// Phase 2b/2d: wire the nav-hierarchy controllers once in their legacy
// (getState, setState, apis) shape. getState reads a ref so the callbacks stay
// referentially stable regardless of re-renders; setState dispatches a merge
// patch. Later phases extend AppController with chat/composer/workspace actions.

export interface AppController {
  loadMachines: () => Promise<void>;
  loadProjects: (machineId?: string) => Promise<void>;
  loadWorkspaces: (projectId: string, machineId?: string) => Promise<void>;
  loadSessions: (cwd: string, machineId?: string) => Promise<void>;
  /** Persist the selected machine into state + cascade its projects. */
  selectMachine: (machineId: string) => Promise<void>;
  /** Persist the selected project into state + cascade its workspaces. */
  selectProject: (projectId: string) => Promise<void>;
  /** Persist the selected workspace into state + load its sessions. */
  selectWorkspace: (workspaceId: string) => Promise<void>;
  /** Reset workspace-scoped slices when the selected workspace changes. */
  resetWorkspaceScope: () => void;
  /** Send a prompt to a session (fire-and-forget; server drives streaming). */
  sendPrompt: (
    session: SessionRef,
    text: string,
    streamingBehavior?: "steer" | "followUp",
    machineId?: string,
    attachments?: PromptAttachment[],
    delivery?: PromptAttachmentDelivery,
  ) => Promise<void>;
  /** Stop current work + clear the queue for a session. */
  stopSession: (session: SessionRef, machineId?: string) => Promise<void>;
  /** Abort the in-flight response for a session (leaves the queue). */
  abortSession: (session: SessionRef, machineId?: string) => Promise<void>;
  /** Submit answers to the session's open ask_user question set. */
  submitAsk: (session: SessionRef, askId: string, submission: AskUserSubmission, machineId?: string) => Promise<void>;
  /** Answer an open extension dialog with the user's value. */
  answerDialog: (session: SessionRef, dialogId: string, value: ExtensionDialogAnswer, machineId?: string) => Promise<void>;
  /** Dismiss an open extension dialog without answering. */
  cancelDialog: (session: SessionRef, dialogId: string, machineId?: string) => Promise<void>;
  /** Add (or open) a project by path, then select it + cascade its workspaces. Returns the project id. */
  addProject: (path: string, create?: boolean, trust?: ProjectTrustChoice, machineId?: string) => Promise<string | undefined>;
  /** Add a remote machine to the fleet, then select it. */
  addMachine: (input: { name: string; baseUrl: string; token?: string }) => Promise<void>;
}

/** Trust choice submitted with an add-project (mirrors the legacy controller). */
export interface ProjectTrustChoice {
  trusted: boolean;
  changed: boolean;
}

function machineId(state: AppState): string {
  return state.selectedMachine?.id ?? "local";
}

export function useAppController(): {
  state: AppState;
  dispatch: (action: AppAction) => void;
  controller: AppController;
} {
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState);

  // Keep a live ref so controller callbacks read fresh state without being
  // recreated (mirrors the legacy getState closure).
  const stateRef = useRef(state);
  stateRef.current = state;
  const getState = useCallback((): AppState => stateRef.current, []);
  const setState = useCallback(
    (patch: AppStatePatch): void => {
      dispatch({ type: "patch", patch });
    },
    [],
  );

  const controller = useMemo<AppController>(() => {
    const withError = async (label: string, run: () => void | Promise<void>): Promise<void> => {
      try {
        await run();
      } catch (error: unknown) {
        setState({ error: error instanceof Error ? `${label}: ${error.message}` : `${label}: ${String(error)}` });
      }
    };
    const errorMessage = (error: unknown): string =>
      error instanceof Error ? error.message : String(error);

    return {
      loadMachines: () =>
        withError("Load machines", async () => {
          setState({ isLoadingMachines: true });
          const machines = await machinesApi.machines();
          const selected = getState().selectedMachine ?? machines.find((m) => m.id === "local") ?? machines[0];
          setState({ machines, selectedMachine: selected, isLoadingMachines: false });
        }),

      loadProjects: (id) =>
        withError("Load projects", async () => {
          setState({ isLoadingProjects: true });
          const projects = await projectsApi.projects(id ?? machineId(getState()));
          setState({ projects, isLoadingProjects: false });
        }),

      loadWorkspaces: (projectId, id) =>
        withError("Load workspaces", async () => {
          setState({ isLoadingWorkspaces: true });
          const workspaces = await workspacesApi.workspaces(projectId, id ?? machineId(getState()));
          const byProject = { ...getState().workspacesByProjectId, [projectId]: workspaces };
          setState({ workspaces, workspacesByProjectId: byProject, isLoadingWorkspaces: false });
        }),

      loadSessions: (cwd, id) =>
        withError("Load sessions", async () => {
          const sessions = await sessionsApi.sessions(cwd, id ?? machineId(getState()));
          setState({ sessions });
        }),

      selectMachine: (id) =>
        withError("Select machine", () => {
          const match = getState().machines.find((m) => m.id === id);
          if (match === undefined) return;
          // Only persist the selection; AppProvider loads projects reactively off
          // selectedMachine (single source of truth for the cascade).
          if (getState().selectedMachine?.id !== match.id) {
            setState({ selectedMachine: match });
          }
        }),

      selectProject: (projectId) =>
        withError("Select project", () => {
          const match = getState().projects.find((p) => p.id === projectId);
          if (match === undefined) return;
          // Only persist the selection; AppProvider loads workspaces reactively
          // off selectedProject.
          if (getState().selectedProject?.id !== match.id) {
            setState({ selectedProject: match });
          }
        }),

      selectWorkspace: (workspaceId) =>
        withError("Select workspace", () => {
          const match = getState().workspaces.find((w) => w.id === workspaceId);
          if (match === undefined) return;
          // Only persist the selection; NavSidebar loads sessions reactively off
          // selectedWorkspace.path (single source of truth for the session list).
          if (getState().selectedWorkspace?.id !== match.id) {
            setState({ selectedWorkspace: match });
          }
        }),

      resetWorkspaceScope: () => {
        setState(resetWorkspaceScopedState());
      },

      sendPrompt: (session, text, streamingBehavior, id, attachments, delivery = "inline") =>
        withError("Send message", async () => {
          const machine = id ?? machineId(getState());
          const hasAttachments = attachments !== undefined && attachments.length > 0;
          // Folder delivery: persist the files into the workspace, then mention
          // the saved paths in the prompt body (mirrors the legacy controller's
          // deliverPromptToSession). Otherwise attachments ride inline.
          if (hasAttachments && delivery === "folder") {
            const saved = await sessionsApi.saveAttachments(session, attachments, machine);
            const references = saved.map((file) => fileCompletionInsertText(file.path, false)).join(" ");
            const body = text === "" ? references : `${text}\n\n${references}`;
            await sessionsApi.prompt(session, body, streamingBehavior, machine);
          } else {
            await sessionsApi.prompt(session, text, streamingBehavior, machine, attachments);
          }
        }),

      stopSession: (session, id) =>
        withError("Stop", async () => {
          await sessionsApi.stop(session, id ?? machineId(getState()));
        }),

      abortSession: (session, id) =>
        withError("Abort", async () => {
          await sessionsApi.abort(session, id ?? machineId(getState()));
        }),

      // Ask / dialog answering: the card owns its in-flight + draft state and
      // re-throws so a transport failure keeps the card usable; we still surface
      // the error to the global banner. The server returns a fresh SessionStatus
      // (and the socket status.update follows), so no refetch is needed here.
      submitAsk: async (session, askId, submission, id) => {
        try {
          await sessionsApi.submitAsk(session, askId, submission, id ?? machineId(getState()));
        } catch (error) {
          setState({ error: `Submit answers: ${errorMessage(error)}` });
          throw error;
        }
      },

      answerDialog: async (session, dialogId, value, id) => {
        try {
          await sessionsApi.answerDialog(session, dialogId, value, id ?? machineId(getState()));
        } catch (error) {
          setState({ error: `Answer dialog: ${errorMessage(error)}` });
          throw error;
        }
      },

      cancelDialog: async (session, dialogId, id) => {
        try {
          await sessionsApi.cancelDialog(session, dialogId, id ?? machineId(getState()));
        } catch (error) {
          setState({ error: `Cancel dialog: ${errorMessage(error)}` });
          throw error;
        }
      },

      // Add (or open) a project by path. On success the project is persisted +
      // selected (AppProvider cascades its workspaces off selectedProject), the
      // dialog flag is cleared, and — when the user changed the trust toggle —
      // the choice is pinned via the id-based trust route once the main
      // workspace exists (server-resolved path, never a client path). Returns the
      // project id so callers can sync the URL without racing state.
      addProject: async (path, create, trust, id) => {
        const trimmed = path.trim();
        if (trimmed === "") return undefined;
        const machine = id ?? machineId(getState());
        try {
          const project = await projectsApi.addProject(trimmed, undefined, create, machine);
          if (machineId(getState()) !== machine) return undefined;
          const projects = getState().projects;
          setState({
            projects: [...projects.filter((candidate) => candidate.id !== project.id), project],
            selectedProject: project,
            projectDialogOpen: false,
          });
          if (trust?.changed === true) {
            const workspaces = await workspacesApi.workspaces(project.id, machine);
            const mainWorkspace = workspaces.find((workspace) => workspace.isMain);
            if (mainWorkspace !== undefined) {
              await trustApi.setWorkspaceTrust(project.id, mainWorkspace.id, trust.trusted, machine);
            }
          }
          return project.id;
        } catch (error) {
          setState({ error: `Add project: ${errorMessage(error)}` });
          return undefined;
        }
      },

      // Add a remote machine to the fleet. On success the machine is appended +
      // selected (AppProvider cascades its projects off selectedMachine) and the
      // dialog flag is cleared. Errors re-throw so the dialog keeps its own
      // inline error state usable.
      addMachine: async (input) => {
        const machine = await machinesApi.addMachine(input);
        const machines = getState().machines;
        setState({
          machines: [...machines.filter((candidate) => candidate.id !== machine.id), machine],
          selectedMachine: machine,
          machineDialogOpen: false,
        });
      },
    };
  }, [getState, setState]);

  return { state, dispatch, controller };
}

// Context for the controller so nested components can invoke actions.
const AppControllerContext = createContext<AppController | null>(null);

export function useController(): AppController {
  const controller = useContext(AppControllerContext);
  if (controller === null) throw new Error("useController must be used within <AppProvider>");
  return controller;
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const { state, dispatch, controller } = useAppController();

  // Bootstrap the nav hierarchy + drive the cascade off the selected* fields
  // (single source of truth). selectMachine/Project/Workspace only persist the
  // selection; these effects react and load the next level.
  useEffect(() => {
    void controller.loadMachines();
  }, [controller]);

  useEffect(() => {
    if (state.selectedMachine !== undefined) void controller.loadProjects(state.selectedMachine.id);
  }, [controller, state.selectedMachine]);

  useEffect(() => {
    if (state.selectedProject !== undefined) void controller.loadWorkspaces(state.selectedProject.id);
  }, [controller, state.selectedProject]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        <AppControllerContext.Provider value={controller}>{children}</AppControllerContext.Provider>
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}
