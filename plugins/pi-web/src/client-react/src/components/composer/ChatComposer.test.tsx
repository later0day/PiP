import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatComposer } from "./ChatComposer";

// Ports ChatComposer (beautifului #7) to RTL. A chat card with a tabbed header,
// a fixed conversation region playing a scripted reply, and a composer input
// with a tactile send button. Starts in the resolved "done" phase.
describe("ChatComposer", () => {
  it("renders the pre-populated exchange and the tabs", () => {
    render(<ChatComposer />);
    expect(screen.getByText("Compare mint chip to last summer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flavors" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Suppliers" })).toHaveAttribute("aria-pressed", "false");
    // The resolved reply sections are present.
    expect(screen.getByText("Sales History")).toBeInTheDocument();
    expect(screen.getByText("Comparison")).toBeInTheDocument();
  });

  it("switches the active header tab", () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByRole("button", { name: "Suppliers" }));
    expect(screen.getByRole("button", { name: "Suppliers" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Flavors" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps send disabled until the prompt has content", () => {
    render(<ChatComposer />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Chat prompt" }), {
      target: { value: "Restock waffle cones" },
    });
    expect(send).toBeEnabled();
  });

  it("submits a new message into the user bubble", () => {
    render(<ChatComposer />);
    const input = screen.getByRole("textbox", { name: "Chat prompt" });
    fireEvent.change(input, { target: { value: "Restock waffle cones" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Restock waffle cones")).toBeInTheDocument();
    // The input clears after send.
    expect(input).toHaveValue("");
  });

  it("accepts a custom initial submitted message", () => {
    render(<ChatComposer initialSubmitted="Draft a supplier email" />);
    expect(screen.getByText("Draft a supplier email")).toBeInTheDocument();
  });
});
