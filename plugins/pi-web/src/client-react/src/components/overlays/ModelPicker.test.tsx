import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CommandOption, SessionModelCatalogEntry } from "@shared/apiTypes";
import {
  ModelPicker,
  filterModelOptions,
  modelCatalogEntryValue,
  modelCatalogToggleAllPlan,
  modelCatalogView,
} from "./ModelPicker";

const OPTIONS: CommandOption[] = [
  { value: "anthropic/claude", label: "Claude", description: "Anthropic" },
  { value: "openai/gpt", label: "GPT", description: "OpenAI" },
];

const entry = (over: Partial<SessionModelCatalogEntry> & Pick<SessionModelCatalogEntry, "provider" | "id">): SessionModelCatalogEntry => ({
  enabled: true,
  ...over,
});

const CATALOG: SessionModelCatalogEntry[] = [
  entry({ provider: "anthropic", id: "claude", enabled: true, catalogIndex: 0 }),
  entry({ provider: "openai", id: "gpt", enabled: false, catalogIndex: 1 }),
];

// Ports ModelPicker.catalog.test.ts (pure helpers) + adds RTL coverage of the
// Enabled/All mode toggle, search, catalog membership checkboxes, and picking.
describe("ModelPicker pure helpers", () => {
  it("builds the wire value from provider/id", () => {
    expect(modelCatalogEntryValue({ provider: "anthropic", id: "claude" })).toBe("anthropic/claude");
  });

  it("filters enabled options case-insensitively and returns all on empty query", () => {
    expect(filterModelOptions(OPTIONS, "")).toHaveLength(2);
    expect(filterModelOptions(OPTIONS, "gpt").map((o) => o.value)).toEqual(["openai/gpt"]);
    expect(filterModelOptions(OPTIONS, "ANTHROPIC").map((o) => o.value)).toEqual(["anthropic/claude"]);
  });

  it("orders the catalog view by catalogIndex and filters by query", () => {
    const view = modelCatalogView(CATALOG, "");
    expect(view.rows.map(modelCatalogEntryValue)).toEqual(["anthropic/claude", "openai/gpt"]);
    expect(modelCatalogView(CATALOG, "openai").rows.map(modelCatalogEntryValue)).toEqual(["openai/gpt"]);
  });

  it("plans toggle-all: from a broad scope, deselect down to current", () => {
    const bothEnabled = [
      entry({ provider: "anthropic", id: "claude", enabled: true }),
      entry({ provider: "openai", id: "gpt", enabled: true }),
    ];
    const plan = modelCatalogToggleAllPlan(bothEnabled, "anthropic/claude");
    expect(plan.mode).toBe("current");
    expect(plan.canApply).toBe(true);
    expect(plan.hasChanges).toBe(true);
  });

  it("plans toggle-all: when only current is enabled, offer select-all", () => {
    const onlyCurrent = [
      entry({ provider: "anthropic", id: "claude", enabled: true }),
      entry({ provider: "openai", id: "gpt", enabled: false }),
    ];
    const plan = modelCatalogToggleAllPlan(onlyCurrent, "anthropic/claude");
    expect(plan.mode).toBe("all");
    expect(plan.hasChanges).toBe(true);
  });
});

describe("ModelPicker component", () => {
  it("renders the enabled options by default", () => {
    render(<ModelPicker options={OPTIONS} catalog={CATALOG} onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "选择模型" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claude/ })).toBeInTheDocument();
  });

  it("switches to All models mode and shows membership checkboxes", async () => {
    const user = userEvent.setup();
    render(<ModelPicker options={OPTIONS} catalog={CATALOG} onPick={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "全部模型" }));
    expect(screen.getByRole("checkbox", { name: "禁用 anthropic/claude" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "启用 openai/gpt" })).not.toBeChecked();
  });

  it("toggles a model's enabled membership", async () => {
    const user = userEvent.setup();
    const onToggleEnabled = vi.fn();
    render(<ModelPicker options={OPTIONS} catalog={CATALOG} onPick={vi.fn()} onCancel={vi.fn()} onToggleEnabled={onToggleEnabled} />);
    await user.click(screen.getByRole("button", { name: "全部模型" }));
    await user.click(screen.getByRole("checkbox", { name: "启用 openai/gpt" }));
    expect(onToggleEnabled).toHaveBeenCalledWith("openai", "gpt", true);
  });

  it("picks an enabled option", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ModelPicker options={OPTIONS} catalog={CATALOG} onPick={onPick} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /GPT/ }));
    expect(onPick).toHaveBeenCalledWith("openai/gpt");
  });

  it("filters options via the search box", async () => {
    const user = userEvent.setup();
    render(<ModelPicker options={OPTIONS} catalog={CATALOG} onPick={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "搜索模型" }), "claude");
    expect(screen.getByRole("button", { name: /Claude/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /GPT/ })).not.toBeInTheDocument();
  });
});
