import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AppState } from "@client/appState";
import { initialAppState } from "@client/appState";
import type { SessionInfo, Workspace } from "@shared/apiTypes";
import type { ParsedAppRoute } from "@client/route";

// Ports the NavSidebar wiring component to RTL. It binds the landed SidebarNav to
// pi-web state: the selected workspace's sessions become the rail's recents,
// picking one navigates {sessionId, view:"chat"}, New chat clears the session,
// and sessions load whenever the selected workspace path changes. The three
// state seams (useAppState / useController / useRoute) are stubbed so the wiring
// is exercised without the AppProvider stack or network.
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
const navigate = vi.fn<(patch: Partial<ParsedAppRoute>) => void>();
const loadSessions = vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);

vi.mock("../../state/appStore", () => ({
  useAppState: () => currentState,
}));
vi.mock("../../state/AppProvider", () => ({
  useController: () => ({ loadSessions }),
}));
vi.mock("../../state/useRoute", () => ({
  useRoute: () => ({ route: currentRoute, navigate }),
}));

const { NavSidebar } = await import("./NavSidebar");

const session = (over: Partial<SessionInfo> = {}): SessionInfo => ({
  id: "s1",
  cwd: "/root/orchard",
  path: "/root/orchard/.pi/sessions/s1",
  created: "2026-01-01T00:00:00Z",
  modified: "2026-01-01T00:00:00Z",
  messageCount: 3,
  firstMessage: "Plan the churn",
  ...over,
});

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: "w1",
  projectId: "p1",
  path: "/root/orchard",
  label: "main",
  isMain: true,
  effectiveConfig: { uploads: {} },
  ...over,
});

describe("NavSidebar", () => {
  beforeEach(() => {
    navigate.mockClear();
    loadSessions.mockClear();
    currentRoute = emptyRoute;
    currentState = initialAppState();
  });

  it("renders each session as a recent using its name or first message", () => {
    currentState = {
      ...initialAppState(),
      sessions: [session({ name: "Freezer audit" }), session({ id: "s2", name: undefined, firstMessage: "Restock plan" })],
    };
    render(<NavSidebar />);
    expect(screen.getByText("Freezer audit")).toBeInTheDocument();
    expect(screen.getByText("Restock plan")).toBeInTheDocument();
  });

  it("loads sessions when a workspace is selected", () => {
    currentState = { ...initialAppState(), selectedWorkspace: workspace() };
    render(<NavSidebar />);
    expect(loadSessions).toHaveBeenCalledWith("/root/orchard");
  });

  it("navigates to a picked session", () => {
    currentState = { ...initialAppState(), sessions: [session({ name: "Freezer audit" })] };
    render(<NavSidebar />);
    fireEvent.click(screen.getByText("Freezer audit"));
    expect(navigate).toHaveBeenCalledWith({ sessionId: "s1", view: "chat" });
  });

  it("clears the session on New chat", () => {
    currentState = { ...initialAppState(), sessions: [session()] };
    render(<NavSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "新建会话" }));
    expect(navigate).toHaveBeenCalledWith({ sessionId: undefined, view: "chat" });
  });
});
