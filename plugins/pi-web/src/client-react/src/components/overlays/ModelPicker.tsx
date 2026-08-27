import clsx from "clsx";
import { type JSX, useMemo, useState } from "react";
import { ModalSurface } from "../../primitives";
import type { CommandOption, SessionModelCatalogEntry, SessionModelScopeMode } from "@shared/apiTypes";
import styles from "./ModelPicker.module.css";

// ModelPicker — the session model selection dialog (legacy ModelPicker.ts).
// Enabled mode is the searchable pick list; All models mode lists the machine's
// full catalog with per-model membership checkboxes that edit pi's
// enabled-models scope. Pure helpers (filter/catalog view/toggle-all plan) are
// ported verbatim. DSH-skinned on ModalSurface.

export type ModelPickerMode = "enabled" | "all";

/** The wire value identifying one model row: `${provider}/${id}`. */
export function modelCatalogEntryValue(entry: Pick<SessionModelCatalogEntry, "provider" | "id">): string {
  return `${entry.provider}/${entry.id}`;
}

/** Case-insensitive substring filter over the Enabled-mode options. */
export function filterModelOptions(options: readonly CommandOption[], query: string): CommandOption[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") return [...options];
  return options.filter((option) =>
    `${option.label} ${option.description ?? ""} ${option.value}`.toLowerCase().includes(normalized),
  );
}

function modelCatalogInNaturalOrder(catalog: readonly SessionModelCatalogEntry[]): SessionModelCatalogEntry[] {
  if (!catalog.every((entry) => entry.catalogIndex !== undefined)) return [...catalog];
  return [...catalog].sort((left, right) => (left.catalogIndex ?? 0) - (right.catalogIndex ?? 0));
}

export interface ModelCatalogView {
  rows: SessionModelCatalogEntry[];
}

/** Case-insensitive substring filter over the All-mode catalog (id/provider/name). */
export function modelCatalogView(
  catalog: readonly SessionModelCatalogEntry[],
  query: string,
  stableOrder?: readonly string[],
): ModelCatalogView {
  const naturalRows = modelCatalogInNaturalOrder(catalog);
  const rowsByValue = new Map(naturalRows.map((entry) => [modelCatalogEntryValue(entry), entry]));
  const listed = new Set<string>();
  const orderedRows =
    stableOrder === undefined
      ? naturalRows
      : [
          ...stableOrder.flatMap((value) => {
            const entry = rowsByValue.get(value);
            if (entry === undefined || listed.has(value)) return [];
            listed.add(value);
            return [entry];
          }),
          ...naturalRows.filter((entry) => !listed.has(modelCatalogEntryValue(entry))),
        ];
  const normalized = query.trim().toLowerCase();
  return {
    rows:
      normalized === ""
        ? orderedRows
        : orderedRows.filter((entry) =>
            `${entry.provider} ${entry.id} ${entry.name ?? ""}`.toLowerCase().includes(normalized),
          ),
  };
}

export interface ModelCatalogToggleAllPlan {
  mode: SessionModelScopeMode;
  canApply: boolean;
  hasChanges: boolean;
}

/** Toggle between every model and the smallest usable scope: the current model. */
export function modelCatalogToggleAllPlan(
  catalog: readonly SessionModelCatalogEntry[],
  currentValue: string | undefined,
): ModelCatalogToggleAllPlan {
  const enabledEntries = catalog.filter((entry) => entry.enabled);
  const current =
    currentValue === undefined
      ? undefined
      : catalog.find((entry) => modelCatalogEntryValue(entry) === currentValue);
  const onlyCurrentEnabled = current?.enabled === true && enabledEntries.length === 1;
  const mode: SessionModelScopeMode = enabledEntries.length === 0 || onlyCurrentEnabled ? "all" : "current";
  return {
    mode,
    canApply: mode === "all" || current !== undefined,
    hasChanges:
      mode === "all"
        ? enabledEntries.length < catalog.length
        : current !== undefined && (!current.enabled || enabledEntries.some((entry) => entry !== current)),
  };
}

export interface ModelPickerProps {
  title?: string;
  options: CommandOption[];
  catalog: SessionModelCatalogEntry[];
  selectedValue?: string;
  onPick: (value: string) => void;
  onCancel: () => void;
  onToggleEnabled?: (provider: string, modelId: string, enabled: boolean) => void;
  onSetScope?: (mode: SessionModelScopeMode) => void;
}

export function ModelPicker({
  title = "选择模型",
  options,
  catalog,
  selectedValue,
  onPick,
  onCancel,
  onToggleEnabled,
  onSetScope,
}: ModelPickerProps): JSX.Element {
  const [mode, setMode] = useState<ModelPickerMode>("enabled");
  const [query, setQuery] = useState("");

  const modelScopeEditable = catalog.every((entry) => entry.editable !== false);
  const enabledRows = useMemo(() => filterModelOptions(options, query), [options, query]);
  const catalogRows = useMemo(() => modelCatalogView(catalog, query).rows, [catalog, query]);
  const plan = useMemo(() => modelCatalogToggleAllPlan(catalog, selectedValue), [catalog, selectedValue]);

  const empty = mode === "all" ? catalogRows.length === 0 : enabledRows.length === 0;

  return (
    <ModalSurface onClose={onCancel} initialFocus="input.search" label={title} className={styles.modal}>
      <header className={styles.header}>
        <strong>{title}</strong>
        <button type="button" aria-label="关闭" className={styles.close} onClick={onCancel}>
          ×
        </button>
      </header>
      <div className={styles.scopeToggle} role="group" aria-label="模型范围">
        <button type="button" aria-pressed={mode === "enabled"} onClick={() => { setMode("enabled"); }}>
          已启用
        </button>
        <button type="button" aria-pressed={mode === "all"} onClick={() => { setMode("all"); }}>
          全部模型
        </button>
      </div>
      {!modelScopeEditable && (
        <div className={styles.scopeNotice} role="status">
          <strong>项目覆盖</strong>
          <span>
            正在显示此工作区 <code>.pi/settings.json</code> 中的模型。模型可用性选择已禁用。
          </span>
        </div>
      )}
      <div className={styles.searchRow}>
        <input
          className={clsx(styles.search, "search")}
          aria-label="搜索模型"
          placeholder="搜索"
          value={query}
          onChange={(event) => { setQuery(event.target.value); }}
        />
        {mode === "all" && (
          <button
            type="button"
            className={styles.toggleAll}
            disabled={!modelScopeEditable || !plan.canApply || !plan.hasChanges}
            onClick={() => onSetScope?.(plan.mode)}
          >
            {plan.mode === "all" ? "全选" : "取消全选"}
          </button>
        )}
      </div>
      <div className={styles.options} role="region" aria-label={mode === "all" ? "全部模型" : "已启用模型"}>
        {mode === "all"
          ? catalogRows.map((entry) => {
              const value = modelCatalogEntryValue(entry);
              const isCurrent = value === selectedValue;
              const protectsCurrent = isCurrent && entry.enabled;
              const disabled = !modelScopeEditable || protectsCurrent;
              return (
                <div key={value} className={styles.catalogRow}>
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    disabled={disabled}
                    aria-label={`${entry.enabled ? "禁用" : "启用"} ${value}`}
                    onChange={() => {
                      if (!disabled) onToggleEnabled?.(entry.provider, entry.id, !entry.enabled);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.membership}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => { onPick(value); }}
                  >
                    <span>
                      {entry.id}
                      {isCurrent ? " ✓ 当前" : ""}
                    </span>
                    <small>{entry.provider}</small>
                  </button>
                </div>
              );
            })
          : enabledRows.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === selectedValue ? styles.selected : undefined}
                aria-current={option.value === selectedValue ? "true" : undefined}
                onClick={() => { onPick(option.value); }}
              >
                <span>{option.label}</span>
                {option.description !== undefined && option.description !== "" && <small>{option.description}</small>}
              </button>
            ))}
        {empty && <div className={styles.empty}>无匹配选项</div>}
      </div>
    </ModalSurface>
  );
}
