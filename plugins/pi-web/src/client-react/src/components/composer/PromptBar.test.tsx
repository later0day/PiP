import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PromptBar } from "./PromptBar";

// Ports PromptBar (beautifului #8) to RTL. A composer with @-sources / -commands
// menus, a model picker, dictation, and send. The demo autoplay loop is turned
// off (demo={false}) so state is driven only by the test's interactions.
describe("PromptBar", () => {
  it("renders the input, model picker, and send button", () => {
    render(<PromptBar demo={false} />);
    expect(screen.getByRole("textbox", { name: "Prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("opens the @ source menu when the plus button is toggled", () => {
    render(<PromptBar demo={false} />);
    const plus = screen.getByRole("button", { name: "Add attachments and sources" });
    fireEvent.click(plus);
    expect(plus).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Scoop Data")).toBeInTheDocument();
    expect(screen.getByText("Web search")).toBeInTheDocument();
  });

  it("opens the slash-command menu when the draft starts with /", () => {
    render(<PromptBar demo={false} />);
    const input = screen.getByRole("textbox", { name: "Prompt" });
    fireEvent.change(input, { target: { value: "/" } });
    expect(screen.getByText("/compare")).toBeInTheDocument();
    expect(screen.getByText("/restock")).toBeInTheDocument();
  });

  it("opens the model picker and selects a model", () => {
    render(<PromptBar demo={false} />);
    const trigger = screen.getByRole("button", { name: "Choose model" });
    // The trigger's aria-label is fixed; its visible label starts as the default.
    expect(trigger).toHaveTextContent("Vanilla 1");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // The menu lists each model; pick the flagship.
    fireEvent.click(screen.getByRole("button", { name: /Sprinkles 5/ }));
    expect(trigger).toHaveTextContent("Sprinkles 5");
  });

  it("enables send and fires onSend with the typed text", () => {
    const onSend = vi.fn<(text: string) => void>();
    render(<PromptBar demo={false} onSend={onSend} />);
    const input = screen.getByRole("textbox", { name: "Prompt" });
    fireEvent.change(input, { target: { value: "Churn pistachio" } });
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]?.[0]).toBe("Churn pistachio");
  });
});
