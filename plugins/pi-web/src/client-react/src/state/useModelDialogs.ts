import { useCallback, useState } from "react";
import { sessionsApi } from "@api/clients";
import type {
  CommandOption,
  SessionModel,
  SessionModelCatalogEntry,
  SessionModelScopeMode,
  SessionRef,
  SessionStatus,
} from "@shared/apiTypes";

// Phase 4b: drive the model + thinking-level picker overlays for the composer.
// Loads the option/catalog data on open, applies selection/membership mutations
// through sessionsApi (which returns a fresh SessionStatus / catalog), and
// exposes the CommandOption[] shapes the pickers render. The label helpers
// mirror the legacy PiWebApp dialog builders verbatim.

function modelValue(model: Pick<SessionModel, "provider" | "id">): string {
  return `${model.provider ?? ""}/${model.id ?? ""}`;
}

function modelDialogOptions(
  models: readonly Pick<SessionModel, "provider" | "id">[],
  selectedValue: string | undefined,
): CommandOption[] {
  return models.map((model) => {
    const value = modelValue(model);
    return {
      value,
      label: `${model.id ?? ""}${value === selectedValue ? " ✓ 当前" : ""}`,
      description: model.provider ?? "",
    };
  });
}

function thinkingDescription(level: string): string | undefined {
  switch (level) {
    case "off":
      return "不推理";
    case "minimal":
      return "极简推理（约 1k tokens）";
    case "low":
      return "轻度推理（约 2k tokens）";
    case "medium":
      return "中等推理（约 8k tokens）";
    case "high":
      return "深度推理（约 16k tokens）";
    case "xhigh":
      return "最大推理（约 32k tokens）";
    default:
      return undefined;
  }
}

function thinkingDialogOptions(levels: readonly string[], current: string): CommandOption[] {
  return levels.map((level) => {
    const description = thinkingDescription(level);
    return {
      value: level,
      label: `${level}${level === current ? " ✓ 当前" : ""}`,
      ...(description === undefined ? {} : { description }),
    };
  });
}

export interface ModelDialogState {
  options: CommandOption[];
  catalog: SessionModelCatalogEntry[];
  selectedValue: string | undefined;
}

export interface ThinkingDialogState {
  options: CommandOption[];
  selectedValue: string;
}

export interface ModelDialogs {
  modelDialog: ModelDialogState | undefined;
  thinkingDialog: ThinkingDialogState | undefined;
  openModelDialog: () => void;
  openThinkingDialog: () => void;
  closeModelDialog: () => void;
  closeThinkingDialog: () => void;
  pickModel: (value: string) => void;
  pickThinking: (value: string) => void;
  toggleModelEnabled: (provider: string, modelId: string, enabled: boolean) => void;
  setModelScope: (mode: SessionModelScopeMode) => void;
}

export function useModelDialogs(
  ref: SessionRef | undefined,
  machineId: string,
  status: SessionStatus | undefined,
  onError: (message: string) => void,
): ModelDialogs {
  const [modelDialog, setModelDialog] = useState<ModelDialogState | undefined>(undefined);
  const [thinkingDialog, setThinkingDialog] = useState<ThinkingDialogState | undefined>(undefined);

  const selectedModelValue = status?.model === undefined ? undefined : modelValue(status.model);

  const fail = useCallback(
    (label: string, cause: unknown): void => {
      onError(cause instanceof Error ? `${label}: ${cause.message}` : `${label}: ${String(cause)}`);
    },
    [onError],
  );

  const openModelDialog = useCallback(() => {
    if (ref === undefined) return;
    // Paint the dialog immediately from what we know, then refresh with the
    // catalog once it loads (mirrors the legacy two-step open).
    setModelDialog({ options: [], catalog: [], selectedValue: selectedModelValue });
    void Promise.all([sessionsApi.models(ref, machineId), sessionsApi.modelCatalog(ref, machineId)])
      .then(([models, catalog]) => {
        setModelDialog({
          options: modelDialogOptions(models.models, selectedModelValue),
          catalog: catalog.models,
          selectedValue: selectedModelValue,
        });
      })
      .catch((cause: unknown) => {
        setModelDialog(undefined);
        fail("加载模型失败", cause);
      });
  }, [ref, machineId, selectedModelValue, fail]);

  const openThinkingDialog = useCallback(() => {
    if (ref === undefined) return;
    const current = status?.thinkingLevel ?? "off";
    void sessionsApi
      .thinkingLevels(ref, machineId)
      .then((response) => {
        setThinkingDialog({ options: thinkingDialogOptions(response.levels, current), selectedValue: current });
      })
      .catch((cause: unknown) => { fail("加载思考级别失败", cause); });
  }, [ref, machineId, status?.thinkingLevel, fail]);

  const closeModelDialog = useCallback(() => { setModelDialog(undefined); }, []);
  const closeThinkingDialog = useCallback(() => { setThinkingDialog(undefined); }, []);

  const pickModel = useCallback(
    (value: string) => {
      if (ref === undefined) return;
      const slash = value.indexOf("/");
      const provider = value.slice(0, slash);
      const modelId = value.slice(slash + 1);
      setModelDialog(undefined);
      void sessionsApi.setModel(ref, provider, modelId, machineId).catch((cause: unknown) => { fail("设置模型失败", cause); });
    },
    [ref, machineId, fail],
  );

  const pickThinking = useCallback(
    (value: string) => {
      if (ref === undefined) return;
      setThinkingDialog(undefined);
      void sessionsApi
        .setThinkingLevel(ref, value, machineId)
        .catch((cause: unknown) => { fail("设置思考级别失败", cause); });
    },
    [ref, machineId, fail],
  );

  const toggleModelEnabled = useCallback(
    (provider: string, modelId: string, enabled: boolean) => {
      if (ref === undefined) return;
      void sessionsApi
        .setModelEnabled(ref, provider, modelId, enabled, machineId)
        .then((catalog) => {
          setModelDialog((current) => (current === undefined ? current : { ...current, catalog: catalog.models }));
        })
        .catch((cause: unknown) => { fail("切换模型失败", cause); });
    },
    [ref, machineId, fail],
  );

  const setModelScope = useCallback(
    (mode: SessionModelScopeMode) => {
      if (ref === undefined) return;
      void sessionsApi
        .setModelScope(ref, mode, machineId)
        .then((catalog) => {
          setModelDialog((current) => (current === undefined ? current : { ...current, catalog: catalog.models }));
        })
        .catch((cause: unknown) => { fail("设置模型范围失败", cause); });
    },
    [ref, machineId, fail],
  );

  return {
    modelDialog,
    thinkingDialog,
    openModelDialog,
    openThinkingDialog,
    closeModelDialog,
    closeThinkingDialog,
    pickModel,
    pickThinking,
    toggleModelEnabled,
    setModelScope,
  };
}
