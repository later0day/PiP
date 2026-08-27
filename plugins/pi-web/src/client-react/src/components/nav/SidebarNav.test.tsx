import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarNav, type SidebarRecent } from "./SidebarNav";

const RECENTS: SidebarRecent[] = [
  { id: "suppliers", label: "Supplier records" },
  { id: "todos", label: "Urgent to-dos" },
  { id: "flavor", label: "Flavor page ticket", prompt: "Draft the flavor page" },
];

// Ports the SidebarNav interactions to RTL: recents render, picking a recent
// fires onPick with id/label/prompt, New chat fires onNewChat, the search field
// filters recents (with an empty state), and the collapse control hides the copy.
describe("SidebarNav", () => {
  it("renders the recents list", () => {
    render(<SidebarNav recents={RECENTS} />);
    expect(screen.getByRole("button", { name: "Supplier records" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flavor page ticket" })).toBeInTheDocument();
  });

  it("fires onPick with the recent's id, label, and prompt", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn<(id: string, label: string, prompt?: string) => void>();
    render(<SidebarNav recents={RECENTS} onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Flavor page ticket" }));
    expect(onPick).toHaveBeenCalledWith("flavor", "Flavor page ticket", "Draft the flavor page");
  });

  it("fires onNewChat when New chat is clicked", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn<() => void>();
    render(<SidebarNav recents={RECENTS} onNewChat={onNewChat} />);
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("filters recents through the chat search field", async () => {
    const user = userEvent.setup();
    render(<SidebarNav recents={RECENTS} />);
    await user.click(screen.getByRole("button", { name: "Search chats" }));
    const search = screen.getByRole("textbox", { name: "Search chat history" });
    await user.type(search, "flavor");
    expect(screen.getByRole("button", { name: "Flavor page ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supplier records" })).not.toBeInTheDocument();
  });

  it("shows an empty state when the search matches no recents", async () => {
    const user = userEvent.setup();
    render(<SidebarNav recents={RECENTS} />);
    await user.click(screen.getByRole("button", { name: "Search chats" }));
    await user.type(screen.getByRole("textbox", { name: "Search chat history" }), "zzz");
    expect(screen.getByText("No chats found")).toBeInTheDocument();
  });

  it("collapses the sidebar and reveals the expand control", async () => {
    const user = userEvent.setup();
    render(<SidebarNav recents={RECENTS} />);
    const sidebar = screen.getByRole("complementary", { name: "Workspace navigation" });
    expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "true");
  });

  it("controls the primary-nav selection and reports navigation", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<(key: string) => void>();
    render(<SidebarNav recents={RECENTS} activeNav="home" onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: /Invite users/ }));
    expect(onNavigate).toHaveBeenCalledWith("invite");
  });
});
