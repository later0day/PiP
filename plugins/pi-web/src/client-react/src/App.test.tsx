import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppState } from "@client/appState";
import { initialAppState } from "@client/appState";
import type { Workspace } from "@shared/apiTypes";
import type { ParsedAppRoute } from "@client/route";

// Covers the App shell composition: it always renders the sidebar + chat region,
// and mounts the workspace panel only when a workspace is selected AND the route
// names one of its tools/panels (view/tool ≠ chat/navigation). AppProvider and
// the four shell regions own their own (tested) wiring, so they're stubbed to
// data-testid markers; the store + route seams drive the mount decision.
const emptyRoute: ParsedAppRoute = {
  machineId: undefined,
  projectId: undefined,
  workspaceId: undefined,
  sessionId: undefined,
  tool: undefined,
  view: undefined,
};

let currentState: AppState = initialAppState();
let currentRoute: ParsedAppRoute = emptyRoute;
const navigate = vi.fn<(patch: Partial<ParsedAppRoute>, options?: { replace?: boolean }) => void>();

vi.mock("./state/AppProvider", () => ({ AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("./state/appStore", () => ({ useAppState: () => currentState }));
vi.mock("./state/useRoute", () => ({ useRoute: () => ({ route: currentRoute, navigate }) }));
vi.mock("./components/shell/NavSidebar", () => ({ NavSidebar: () => <div data-testid="nav-sidebar" /> }));
vi.mock("./components/shell/ContextBar", () => ({ ContextBar: () => <div data-testid="context-bar" /> }));
vi.mock("./components/shell/ChatPanel", () => ({ ChatPanel: () => <div data-testid="chat-panel" /> }));
vi.mock("./components/workspace/WorkspacePanel", () => ({ WorkspacePanel: () => <div data-testid="workspace-panel" /> }));

const { default: App } = await import("./App");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: "w1",
  projectId: "p1",
  path: "/root/orchard",
  label: "main",
  isMain: true,
  effectiveConfig: { uploads: {} },
  ...over,
});

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRoute = emptyRoute;
    currentState = initialAppState();
  });

  it("renders the sidebar and chat region", () => {
    render(<App />);
    expect(screen.getByTestId("nav-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("context-bar")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("does not mount the workspace panel for the chat view", () => {
    currentState = { ...initialAppState(), selectedWorkspace: workspace() };
    currentRoute = { ...emptyRoute, workspaceId: "w1", view: "chat" };
    render(<App />);
    expect(screen.queryByTestId("workspace-panel")).not.toBeInTheDocument();
  });

  it("mounts the workspace panel when the route names a workspace tool", () => {
    currentState = { ...initialAppState(), selectedWorkspace: workspace() };
    currentRoute = { ...emptyRoute, workspaceId: "w1", view: "files" };
    render(<App />);
    expect(screen.getByTestId("workspace-panel")).toBeInTheDocument();
  });

  it("does not mount the workspace panel when no workspace is selected", () => {
    currentRoute = { ...emptyRoute, view: "files" };
    render(<App />);
    expect(screen.queryByTestId("workspace-panel")).not.toBeInTheDocument();
  });
});
