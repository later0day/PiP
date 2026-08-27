import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CommandOption } from "@shared/apiTypes";
import { CommandPicker } from "./CommandPicker";

const OPTIONS: CommandOption[] = [
  { value: "low", label: "Low", description: "Quick answers" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High", description: "Deep reasoning" },
];

// Ports CommandPicker.test.ts: title/close wiring, option render, arrow-key
// navigation with wraparound, Enter-to-pick, click-to-pick, and (when
// searchable) query filtering + empty state.
describe("CommandPicker", () => {
  it("renders the title and all options", () => {
    render(
      <CommandPicker title="Select Thinking Level" options={OPTIONS} onPick={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("dialog", { name: "Select Thinking Level" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Low/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deep reasoning/ })).toBeInTheDocument();
  });

  it("marks the selected value as current on open", () => {
    render(<CommandPicker options={OPTIONS} selectedValue="high" onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /High/ })).toHaveAttribute("aria-current", "true");
  });

  it("navigates with ArrowDown and picks with Enter", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CommandPicker options={OPTIONS} selectedValue="low" onPick={onPick} onCancel={vi.fn()} />);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith("medium");
  });

  it("wraps around with ArrowUp from the first item", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CommandPicker options={OPTIONS} selectedValue="low" onPick={onPick} onCancel={vi.fn()} />);
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onPick).toHaveBeenCalledWith("high");
  });

  it("picks on click", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CommandPicker options={OPTIONS} onPick={onPick} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Medium/ }));
    expect(onPick).toHaveBeenCalledWith("medium");
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CommandPicker options={OPTIONS} onPick={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("filters options and shows the empty state when searchable", async () => {
    const user = userEvent.setup();
    render(<CommandPicker searchable options={OPTIONS} onPick={vi.fn()} onCancel={vi.fn()} />);
    const search = screen.getByPlaceholderText("搜索");
    await user.type(search, "deep");
    expect(screen.getByRole("button", { name: /High/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Low/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("无匹配选项")).toBeInTheDocument();
  });
});
