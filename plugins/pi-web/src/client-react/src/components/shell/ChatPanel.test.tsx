import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppState } from "@client/appState";
import { initialAppState } from "@client/appState";
import type { SessionInfo } from "@shared/apiTypes";
import type { ParsedAppRoute } from "@client/route";
import type { SessionTranscript } from "../../state/useSessionTranscript";
import type { SessionStatusState } from "../../state/useSessionStatus";
import type { ModelDialogs } from "../../state/useModelDialogs";

// Ports the ChatPanel wiring component to RTL. It resolves the selected session
// (route.sessionId → state.sessions), streams history through
// useSessionTranscript → ChatView, tracks status through useSessionStatus for the
// send/steer/stop dock, and renders the empty state when no session is selected.
// All state seams are stubbed so the branching wiring is exercised without the
// AppProvider stack, sockets, or CodeMirror composer internals.
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
let transcript: SessionTranscript = { messages: [], loading: false, error: undefined };
let statusState: SessionStatusState = { status: undefined, loading: false, error: undefined };

const dialogs: ModelDialogs = {
  modelDialog: undefined,
  thinkingDialog: undefined,
  openModelDialog: vi.fn(),
  openThinkingDialog: vi.fn(),
  closeModelDialog: vi.fn(),
  closeThinkingDialog: vi.fn(),
  pickModel: vi.fn(),
  pickThinking: vi.fn(),
  toggleModelEnabled: vi.fn(),
  setModelScope: vi.fn(),
};

vi.mock("../../state/appStore", () => ({
  useAppState: () => currentState,
  useSetState: () => vi.fn(),
}));
vi.mock("../../state/AppProvider", () => ({
  useController: () => ({
    sendPrompt: vi.fn().mockResolvedValue(undefined),
    stopSession: vi.fn().mockResolvedValue(undefined),
    submitAsk: vi.fn().mockResolvedValue(undefined),
    answerDialog: vi.fn().mockResolvedValue(undefined),
    cancelDialog: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../state/useRoute", () => ({ useRoute: () => ({ route: currentRoute, navigate: vi.fn() }) }));
vi.mock("../../state/useSessionTranscript", () => ({ useSessionTranscript: () => transcript }));
vi.mock("../../state/useSessionStatus", () => ({ useSessionStatus: () => statusState }));
vi.mock("../../state/useModelDialogs", () => ({ useModelDialogs: () => dialogs }));

// The PromptComposer wraps CodeMirror; stub it so the ChatPanel wiring is tested
// without editor internals leaking into these assertions.
vi.mock("../composer/PromptComposer", () => ({
  PromptComposer: () => <div data-testid="prompt-composer" />,
}));

const { ChatPanel } = await import("./ChatPanel");

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

describe("ChatPanel", () => {
  beforeEach(() => {
    currentState = initialAppState();
    currentRoute = emptyRoute;
    transcript = { messages: [], loading: false, error: undefined };
    statusState = { status: undefined, loading: false, error: undefined };
  });

  it("prompts to select a workspace when nothing is selected", () => {
    render(<ChatPanel />);
    expect(screen.getByText("请选择机器、项目和工作区以开始。")).toBeInTheDocument();
  });

  it("shows the New chat empty state once a workspace is chosen but no session", () => {
    currentRoute = { ...emptyRoute, workspaceId: "w1" };
    render(<ChatPanel />);
    expect(screen.getByText("新会话")).toBeInTheDocument();
    expect(screen.getByText("从侧栏选择一个会话，或新建一个。")).toBeInTheDocument();
  });

  it("renders the transcript and composer for the selected session", () => {
    currentRoute = { ...emptyRoute, sessionId: "s1", view: "chat" };
    currentState = { ...initialAppState(), sessions: [session()] };
    transcript = {
      messages: [{ role: "assistant", parts: [{ type: "text", text: "On it" }] }],
      loading: false,
      error: undefined,
    };
    render(<ChatPanel />);
    expect(screen.getByText("On it")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-composer")).toBeInTheDocument();
  });

  it("surfaces a transcript load error", () => {
    currentRoute = { ...emptyRoute, sessionId: "s1", view: "chat" };
    currentState = { ...initialAppState(), sessions: [session()] };
    transcript = { messages: [], loading: false, error: "stream lost" };
    render(<ChatPanel />);
    expect(screen.getByText("stream lost")).toBeInTheDocument();
  });
});
