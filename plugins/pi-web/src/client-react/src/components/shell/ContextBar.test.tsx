import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AppState } from "@client/appState";
import { initialAppState } from "@client/appState";
import type { Machine, Project, Workspace } from "@shared/apiTypes";
import type { ParsedAppRoute } from "@client/route";
import type { SessionCleanupState } from "../../state/useSessionCleanup";
import type { SessionCleanupRequest } from "@shared/apiTypes";
import type { UseAuthResult } from "../../state/useAuth";
import type { UseSettingsRouteResult } from "../../state/useSettingsRoute";

// Ports the ContextBar wiring component to RTL. It renders the machine / project
// / workspace selects (bound to state + route), the add-machine / add-project
// triggers (setState flags), and the command-palette / appearance / settings
// controls. The many hook seams are stubbed so the selection + dialog wiring is
// exercised without the AppProvider stack, sockets, or overlay internals.
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
const setState = vi.fn<(patch: Partial<AppState>) => void>();
const navigate = vi.fn<(patch: Partial<ParsedAppRoute>) => void>();
const selectMachine = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
const selectProject = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
const selectWorkspace = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
const settingsOpen = vi.fn<(section: string) => void>();

const cleanup: SessionCleanupState = {
  open: false,
  preview: undefined,
  previewRequest: undefined,
  result: undefined,
  loading: false,
  running: false,
  error: "",
  openDialog: vi.fn(),
  closeDialog: vi.fn(),
  preview_: vi.fn<(request: SessionCleanupRequest) => Promise<void>>().mockResolvedValue(undefined),
  run: vi.fn<(request: SessionCleanupRequest) => Promise<void>>().mockResolvedValue(undefined),
};

const auth: UseAuthResult = {
  authDialog: undefined,
  openLogin: vi.fn(),
  openLogout: vi.fn(),
  chooseMethod: vi.fn(),
  selectProvider: vi.fn(),
  logoutProvider: vi.fn(),
  updateOAuthInput: vi.fn(),
  respondOAuth: vi.fn(),
  cancelOAuth: vi.fn(),
  closeDialog: vi.fn(),
};

const settingsRoute: UseSettingsRouteResult = {
  section: undefined,
  open: settingsOpen,
  navigate: settingsOpen,
  close: vi.fn(),
};

vi.mock("../../state/appStore", () => ({
  useAppState: () => currentState,
  useSetState: () => setState,
}));
vi.mock("../../state/AppProvider", () => ({
  useController: () => ({ selectMachine, selectProject, selectWorkspace, addMachine: vi.fn(), addProject: vi.fn() }),
}));
vi.mock("../../state/useRoute", () => ({ useRoute: () => ({ route: currentRoute, navigate }) }));
vi.mock("../../state/useSessionCleanup", () => ({ useSessionCleanup: () => cleanup }));
vi.mock("../../state/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../../state/useSettingsRoute", () => ({ useSettingsRoute: () => settingsRoute }));
vi.mock("../../state/useActions", () => ({ useActions: () => [] }));

const { ContextBar } = await import("./ContextBar");

const machine = (over: Partial<Machine> = {}): Machine => ({
  id: "local",
  name: "local",
  kind: "local",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

const project = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "orchard",
  path: "/root/orchard",
  createdAt: "2026-01-01T00:00:00Z",
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

describe("ContextBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRoute = emptyRoute;
    currentState = initialAppState();
  });

  it("renders the machine, project, and workspace selectors", () => {
    render(<ContextBar />);
    expect(screen.getByRole("combobox", { name: "选择机器" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择项目" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择工作区" })).toBeInTheDocument();
  });

  it("lists loaded projects and navigates on selection", () => {
    currentState = {
      ...initialAppState(),
      machines: [machine()],
      selectedMachine: machine(),
      projects: [project(), project({ id: "p2", name: "creamery" })],
    };
    render(<ContextBar />);
    fireEvent.change(screen.getByRole("combobox", { name: "选择项目" }), { target: { value: "p2" } });
    expect(navigate).toHaveBeenCalledWith({ projectId: "p2", workspaceId: undefined, sessionId: undefined });
    expect(selectProject).toHaveBeenCalledWith("p2");
  });

  it("opens the add-project dialog", () => {
    render(<ContextBar />);
    fireEvent.click(screen.getByRole("button", { name: "添加项目" }));
    expect(setState).toHaveBeenCalledWith({ projectDialogOpen: true });
  });

  it("opens the add-machine dialog", () => {
    render(<ContextBar />);
    fireEvent.click(screen.getByRole("button", { name: "添加机器" }));
    expect(setState).toHaveBeenCalledWith({ machineDialogOpen: true });
  });

  it("opens the settings dialog to the general section", () => {
    render(<ContextBar />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(settingsOpen).toHaveBeenCalledWith("general");
  });

  it("opens the command palette", () => {
    render(<ContextBar />);
    fireEvent.click(screen.getByRole("button", { name: "命令面板" }));
    expect(setState).toHaveBeenCalledWith({ actionPaletteOpen: true });
  });

  it("selects a workspace when one is chosen", () => {
    currentState = {
      ...initialAppState(),
      machines: [machine()],
      selectedMachine: machine(),
      workspaces: [workspace(), workspace({ id: "w2", label: "feature" })],
    };
    render(<ContextBar />);
    fireEvent.change(screen.getByRole("combobox", { name: "选择工作区" }), { target: { value: "w2" } });
    expect(navigate).toHaveBeenCalledWith({ workspaceId: "w2", sessionId: undefined });
    expect(selectWorkspace).toHaveBeenCalledWith("w2");
  });
});
