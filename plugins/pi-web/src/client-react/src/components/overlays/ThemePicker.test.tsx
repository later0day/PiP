import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemePicker } from "./ThemePicker";
import { currentChoice } from "../../theme/bootTheme";

afterEach(() => {
  localStorage.clear();
  document.body.removeAttribute("data-ds-dark-theme");
});

// Ports the ThemePicker interaction to RTL: the three appearance options render
// with the persisted choice checked, picking one applies + persists it live, and
// Done closes.
describe("ThemePicker", () => {
  it("renders the appearance options as a radiogroup", () => {
    render(<ThemePicker onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "外观" })).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "主题" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /自动/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /浅色/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /深色/ })).toBeInTheDocument();
  });

  it("defaults to Auto when no preference is pinned", () => {
    render(<ThemePicker onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /自动/ })).toBeChecked();
  });

  it("pins Dark on pick and persists it through the boot-theme seam", async () => {
    const user = userEvent.setup();
    render(<ThemePicker onClose={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /深色/ }));
    expect(screen.getByRole("radio", { name: /深色/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /自动/ })).not.toBeChecked();
    expect(currentChoice()).toBe("dsh-dark");
    expect(document.body.hasAttribute("data-ds-dark-theme")).toBe(true);
  });

  it("pins Light on pick", async () => {
    const user = userEvent.setup();
    render(<ThemePicker onClose={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /浅色/ }));
    expect(currentChoice()).toBe("dsh-light");
    expect(document.body.hasAttribute("data-ds-dark-theme")).toBe(false);
  });

  it("closes via Done and the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();
    render(<ThemePicker onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "完成" }));
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
