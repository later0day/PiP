import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AutocompleteMenu } from "./AutocompleteMenu";
import type { CompletionItem } from "../../state/completionTypes";

// Ports the composer completion dropdown to RTL. Covers the listbox/option roles,
// the selected highlight, mousedown-to-pick (preventDefault keeps focus), and the
// null render when there are no items.
const item = (over: Partial<CompletionItem> = {}): CompletionItem => ({
  kind: "command",
  replaceFrom: 0,
  replaceTo: 0,
  insertText: "/compare",
  detail: "Flavor vs. last summer",
  ...over,
});

describe("AutocompleteMenu", () => {
  it("renders each completion as an option with its insertText and detail", () => {
    render(
      <AutocompleteMenu
        items={[item(), item({ insertText: "/restock", detail: "Build a reorder list" })]}
        selectedIndex={0}
        onPick={vi.fn()}
      />,
    );
    const listbox = screen.getByRole("listbox", { name: "自动补全" });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByText("/compare")).toBeInTheDocument();
    expect(screen.getByText("Flavor vs. last summer")).toBeInTheDocument();
    expect(screen.getByText("/restock")).toBeInTheDocument();
  });

  it("marks the selected row via aria-selected", () => {
    render(
      <AutocompleteMenu
        items={[item(), item({ insertText: "/restock", detail: "Build a reorder list" })]}
        selectedIndex={1}
        onPick={vi.fn()}
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("renders the optional description when present", () => {
    render(
      <AutocompleteMenu
        items={[item({ description: "Digest the thread" })]}
        selectedIndex={0}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText("Digest the thread")).toBeInTheDocument();
  });

  it("calls onPick with the item on mousedown", () => {
    const onPick = vi.fn<(item: CompletionItem) => void>();
    const only = item();
    render(<AutocompleteMenu items={[only]} selectedIndex={0} onPick={onPick} />);
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0]).toEqual(only);
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(
      <AutocompleteMenu items={[]} selectedIndex={0} onPick={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
