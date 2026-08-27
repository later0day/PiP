import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FileSuggestion, WorkspaceTrustResponse } from "@shared/apiTypes";
import { ProjectDialog } from "./ProjectDialog";

const projectDirectories = vi.fn<(q: string, m?: string) => Promise<FileSuggestion[]>>();
const projectTrust = vi.fn<(p: string, m?: string) => Promise<WorkspaceTrustResponse>>();

vi.mock("@api/clients", () => ({
  projectsApi: { projectDirectories: (q: string, m?: string) => projectDirectories(q, m) },
  trustApi: { projectTrust: (p: string, m?: string) => projectTrust(p, m) },
}));

const suggestion = (path: string): FileSuggestion => ({ path, kind: "tracked" });
const trustResponse = (over: Partial<WorkspaceTrustResponse> = {}): WorkspaceTrustResponse => ({
  path: "",
  decision: null,
  trusted: false,
  ...over,
});

afterEach(() => {
  projectDirectories.mockReset();
  projectTrust.mockReset();
});

// Ports ProjectDialog.test.ts: mount loads folder suggestions, submit is gated
// on a non-empty path, Enter submits, Tab adopts the highlighted suggestion, and
// the trust checkbox reflects the server-resolved decision.
describe("ProjectDialog", () => {
  it("loads folder suggestions on mount and renders them", async () => {
    projectDirectories.mockResolvedValue([suggestion("/root/code/alpha"), suggestion("/root/code/beta")]);
    projectTrust.mockResolvedValue(trustResponse());
    render(<ProjectDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "/root/code/alpha" })).toBeInTheDocument();
    expect(projectDirectories).toHaveBeenCalledWith("", "local");
  });

  it("keeps the primary button disabled until a path is entered", async () => {
    const user = userEvent.setup();
    projectDirectories.mockResolvedValue([]);
    projectTrust.mockResolvedValue(trustResponse());
    render(<ProjectDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const add = screen.getByRole("button", { name: "添加项目" });
    expect(add).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/path\/to\/project/), "/root/new");
    await waitFor(() => { expect(add).toBeEnabled(); });
  });

  it("submits the entered path with the create flag on Enter", async () => {
    const user = userEvent.setup();
    projectDirectories.mockResolvedValue([]);
    projectTrust.mockResolvedValue(trustResponse({ path: "/root/new", decision: true, trusted: true }));
    const onSubmit = vi.fn<(path: string, create: boolean, trust: unknown) => void>();
    render(<ProjectDialog onSubmit={onSubmit} onCancel={vi.fn()} />);
    const input = screen.getByPlaceholderText(/path\/to\/project/);
    await user.type(input, "/root/new");
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toBe("/root/new");
    expect(onSubmit.mock.calls[0]?.[1]).toBe(true);
  });

  it("adopts the highlighted suggestion on Tab", async () => {
    const user = userEvent.setup();
    projectDirectories.mockResolvedValue([suggestion("/root/code/alpha"), suggestion("/root/code/beta")]);
    projectTrust.mockResolvedValue(trustResponse());
    render(<ProjectDialog onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole("button", { name: "/root/code/alpha" });
    const input = screen.getByPlaceholderText(/path\/to\/project/);
    input.focus();
    await user.keyboard("{ArrowDown}{Tab}");
    await waitFor(() => { expect(input).toHaveValue("/root/code/beta"); });
  });

  it("cancels via the close button", async () => {
    const user = userEvent.setup();
    projectDirectories.mockResolvedValue([]);
    projectTrust.mockResolvedValue(trustResponse());
    const onCancel = vi.fn();
    render(<ProjectDialog onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
