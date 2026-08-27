import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppFrame } from "./AppFrame";

// Ports the panels-floating-on-canvas shell to RTL. Three regions
// (sidebar | chat | workspace) render their slotted content; the workspace panel
// and its resize separator only mount when a workspace node is provided; the
// mobile tab bar switches the active region via data-mobile-active.
describe("AppFrame", () => {
  it("renders the sidebar and chat slots", () => {
    render(<AppFrame sidebar={<div>Nav rail</div>} chat={<div>Transcript</div>} />);
    expect(screen.getByText("Nav rail")).toBeInTheDocument();
    expect(screen.getByText("Transcript")).toBeInTheDocument();
  });

  it("omits the workspace panel and resize separator when no workspace is given", () => {
    render(<AppFrame sidebar={<div>Nav</div>} chat={<div>Chat</div>} />);
    expect(screen.queryByRole("separator", { name: "调整工作区面板宽度" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "工作区" })).not.toBeInTheDocument();
  });

  it("mounts the workspace panel with a resize separator when provided", () => {
    render(<AppFrame sidebar={<div>Nav</div>} chat={<div>Chat</div>} workspace={<div>Files</div>} />);
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "调整工作区面板宽度" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工作区" })).toBeInTheDocument();
  });

  it("switches the active mobile tab", () => {
    render(<AppFrame sidebar={<div>Nav rail</div>} chat={<div>Transcript</div>} />);
    const navPanel = screen.getByText("Nav rail").parentElement;
    const chatPanel = screen.getByText("Transcript").parentElement;
    expect(navPanel).not.toBeNull();
    expect(chatPanel).not.toBeNull();
    // Chat is the default active tab.
    expect(chatPanel).toHaveAttribute("data-mobile-active", "true");
    expect(navPanel).toHaveAttribute("data-mobile-active", "false");
    fireEvent.click(screen.getByRole("button", { name: "导航" }));
    expect(navPanel).toHaveAttribute("data-mobile-active", "true");
    expect(chatPanel).toHaveAttribute("data-mobile-active", "false");
  });
});
