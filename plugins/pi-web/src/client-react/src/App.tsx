import type { JSX } from "react";
import { AppProvider } from "./state/AppProvider";
import { useAppState } from "./state/appStore";
import { useRoute } from "./state/useRoute";
import { AppFrame } from "./components/shell/AppFrame";
import { NavSidebar } from "./components/shell/NavSidebar";
import { ContextBar } from "./components/shell/ContextBar";
import { ChatPanel } from "./components/shell/ChatPanel";
import { WorkspacePanel } from "./components/workspace/WorkspacePanel";

// Phase 2: the panels-on-canvas shell. AppProvider wires the state store +
// nav-hierarchy controllers; AppFrame lays out sidebar | chat | workspace.
// Phase 5 mounts the workspace panel (Files/Terminals + plugin panels) when the
// route names a workspace tool/panel view (?view=files|terminal|<panelId> or
// ?tool=…).

function ChatRegion(): JSX.Element {
  return (
    <>
      <ContextBar />
      <ChatPanel />
    </>
  );
}

/** True when the route value names a workspace tool or plugin panel (not chat). */
function isWorkspaceView(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "chat" && value !== "navigation";
}

function Shell(): JSX.Element {
  const state = useAppState();
  const { route, navigate } = useRoute();

  const workspace = state.selectedWorkspace ?? state.workspaces.find((w) => w.id === route.workspaceId);
  const activeToolId = isWorkspaceView(route.view) ? route.view : isWorkspaceView(route.tool) ? route.tool : undefined;
  const machineId = state.selectedMachine?.id ?? route.machineId ?? "local";

  // The workspace panel mounts only when a workspace is selected and the route
  // names one of its tools/panels; otherwise the shell is sidebar | chat.
  const workspaceNode =
    workspace !== undefined && activeToolId !== undefined ? (
      <WorkspacePanel
        machineId={machineId}
        workspace={workspace}
        activeToolId={activeToolId}
        onSelectTool={(next) => { navigate({ view: next, tool: next }, { replace: true }); }}
      />
    ) : undefined;

  return <AppFrame sidebar={<NavSidebar />} chat={<ChatRegion />} workspace={workspaceNode} />;
}

export default function App(): JSX.Element {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
