import { useCallback, useEffect, useRef, useState } from "react";
import { configApi, piPackagesApi, pluginsApi } from "@api/clients";
import type {
  PiPackageMutationResponse,
  PiPackageScope,
  PiPackagesResponse,
  PiWebConfigResponse,
  PiWebConfigValues,
  PiWebPluginsResponse,
} from "@shared/apiTypes";
import {
  friendlySelectedMachineSettingsErrorMessage,
  isSelectedMachineSettingsUnsupported,
  pluginLifecycleSupport,
  selectedMachineSettingsSupportKey,
  settingsMachineTarget,
  type SettingsMachineTarget,
} from "@client/components/settings/settingsMachineTarget";
import { mergeSelectedMachineAccessConfig } from "@client/components/settings/settingsMachineAccessConfig";
import { mergeSelectedMachineSessiondConfig } from "@client/components/settings/settingsSessiondConfig";
import { mergeSelectedMachinePluginConfig, pluginEnabledConfigPatch } from "@client/components/settings/settingsPluginConfig";
import {
  piPackagesResponseAfterMutation,
  piPackageTargetContext,
  shouldRefreshGatewayPluginsAfterPiPackageMutation,
  type PiPackageOperationState,
  type PiPackageTargetContext,
} from "@client/components/settings/piPackageSettings";
import type { PiPackageMutationAction } from "@shared/apiTypes";
import { loadPiPackagesData } from "@client/components/settings/settingsDataLoading";
import { useAppState } from "./appStore";

// useSettings — the React port of SettingsDialog's General-section data layer
// (legacy SettingsDialog.ts load/save methods). It owns the gateway config and
// the selected-machine file-access config, with the same requestSeq staleness
// guards + target-change resets the Lit dialog used, and reuses the pure
// settings* logic modules unchanged. Save handlers mirror the local-target
// merge (mergeSelectedMachineAccessConfig) so a local save keeps the two
// responses coherent. The plugins slice (target-scoped config + plugins list,
// with lifecycle-support gating + togglePlugin save) mirrors the legacy
// loadPluginsForTarget/togglePlugin. The packages slice (target-scoped load via
// loadPiPackagesData + install/remove/update mutations via piPackagesApi, with
// the local-gateway plugin refresh + follow-up message) mirrors the legacy
// loadPackagesForTarget/runPiPackageMutation.

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Chinese label for a settings target. Mirrors the shared
// settingsMachineTargetLabel (which stays English for reuse) so the panels and
// status messages read fully localized.
function targetLabelText(target: SettingsMachineTarget): string {
  return target.kind === "local" ? `${target.name}（本地网关）` : `${target.name}（远程机器）`;
}

// Chinese equivalents of the shared piPackageSettings message helpers (which
// stay English for reuse). Ported verbatim in structure so the package panel
// status/error text reads fully localized.
function piPackageTargetLabelText(target: PiPackageTargetContext): string {
  return target.kind === "local" ? `${target.name}（本地网关）` : `${target.name}（远程机器）`;
}

function piPackageFollowUpText(action: PiPackageMutationAction, target: PiPackageTargetContext): string {
  const verb = action === "install" ? "已安装" : action === "remove" ? "已移除" : "已更新";
  const targetSuffix = target.kind === "local" ? "" : `（在 ${target.name} 上）`;
  const sessionScope = target.kind === "local" ? "每个空闲的 PI WEB 会话" : `${target.name} 上每个空闲的 PI WEB 会话`;
  const pluginScope = target.kind === "local" ? "PI WEB 浏览器插件的变更" : `由 ${target.name} 提供的 PI WEB 浏览器插件变更`;
  return `Pi 软件包${verb}${targetSuffix}。在${sessionScope}中输入 /reload 以重新发现 Pi 运行时资源：扩展、技能、提示词模板、主题以及上下文/系统提示文件。请另外刷新浏览器页面以应用${pluginScope}。`;
}

function friendlyPiPackageErrorText(message: string, target: PiPackageTargetContext): string {
  const normalized = message.trim();
  if (target.kind !== "remote") return normalized;
  if (normalized === "Remote machine timeout") {
    return `联系 ${target.name} 进行 Pi 软件包管理超时。该软件包操作可能仍在远程运行；请在重试前重新加载软件包列表。`;
  }
  if (normalized === "Remote machine unavailable") {
    return `无法连接 ${target.name} 进行 Pi 软件包管理。请检查机器连接后重试。`;
  }
  return normalized;
}

export interface SettingsState {
  target: SettingsMachineTarget;
  targetLabel: string;
  configResponse: PiWebConfigResponse | undefined;
  accessConfigResponse: PiWebConfigResponse | undefined;
  loading: boolean;
  accessLoading: boolean;
  saving: boolean;
  error: string;
  accessError: string;
  savedMessage: string;
  reloadConfig: () => Promise<void>;
  reloadAccessConfig: () => Promise<void>;
  saveConfig: (config: PiWebConfigValues) => Promise<void>;
  saveMachineAccessConfig: (config: PiWebConfigValues) => Promise<void>;
  // Sessiond section.
  sessiondConfigResponse: PiWebConfigResponse | undefined;
  sessiondLoading: boolean;
  sessiondError: string;
  reloadSessiondConfig: () => Promise<void>;
  saveSessiondConfig: (config: PiWebConfigValues) => Promise<void>;
  // Plugins section.
  pluginConfigResponse: PiWebConfigResponse | undefined;
  pluginsResponse: PiWebPluginsResponse | undefined;
  pluginLoading: boolean;
  pluginError: string;
  recoveryCommandsSupported: boolean;
  reloadPlugins: () => Promise<void>;
  togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>;
  // Packages section.
  packagesResponse: PiPackagesResponse | undefined;
  packageTarget: PiPackageTargetContext;
  packageLoading: boolean;
  packageOperation: PiPackageOperationState | undefined;
  packageError: string;
  packageMessage: string;
  reloadPackages: () => Promise<void>;
  installPiPackage: (source: string) => Promise<void>;
  removePiPackage: (source: string, scope: PiPackageScope) => Promise<void>;
  updatePiPackage: (source?: string) => Promise<void>;
}

export function useSettings(): SettingsState {
  const state = useAppState();
  const target = settingsMachineTarget(state.selectedMachine);
  const targetId = target.id;
  // Plugin lifecycle diagnostics are gated on the selected machine's runtime
  // capabilities (local is always supported). The support key threads into the
  // plugin load effect deps so a runtime change re-runs the load like the Lit
  // dialog's pluginLifecycleSupportNeedsReload did.
  const runtime = state.machineRuntimes[targetId];
  const lifecycleSupport = pluginLifecycleSupport(target, runtime);
  const supportKey = selectedMachineSettingsSupportKey(lifecycleSupport);
  // Pi package management uses the same selected machine, but its own target
  // context type (piPackageSettings). Derived from the selected machine here.
  const packageTarget = piPackageTargetContext(state.selectedMachine);

  const [configResponse, setConfigResponse] = useState<PiWebConfigResponse | undefined>(undefined);
  const [accessConfigResponse, setAccessConfigResponse] = useState<PiWebConfigResponse | undefined>(undefined);
  const [sessiondConfigResponse, setSessiondConfigResponse] = useState<PiWebConfigResponse | undefined>(undefined);
  const [pluginConfigResponse, setPluginConfigResponse] = useState<PiWebConfigResponse | undefined>(undefined);
  const [pluginsResponse, setPluginsResponse] = useState<PiWebPluginsResponse | undefined>(undefined);
  const [packagesResponse, setPackagesResponse] = useState<PiPackagesResponse | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [sessiondLoading, setSessiondLoading] = useState(true);
  const [pluginLoading, setPluginLoading] = useState(true);
  const [packageLoading, setPackageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [sessiondError, setSessiondError] = useState("");
  const [pluginError, setPluginError] = useState("");
  const [packageError, setPackageError] = useState("");
  const [packageMessage, setPackageMessage] = useState("");
  const [packageOperation, setPackageOperation] = useState<PiPackageOperationState | undefined>(undefined);
  const [savedMessage, setSavedMessage] = useState("");

  // Staleness guards mirroring the legacy requestSeq counters: the access load
  // is also target-scoped, so a target switch mid-flight discards the response.
  const loadSeq = useRef(0);
  const accessSeq = useRef(0);
  const sessiondSeq = useRef(0);
  const pluginSeq = useRef(0);
  // Package loads and mutations coordinate through two counters like the Lit
  // dialog: a mutation bumps the load counter too so an in-flight reload can't
  // clobber the post-mutation list.
  const packageLoadSeq = useRef(0);
  const packageMutationSeq = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The gateway config response, read fresh inside save handlers to compute the
  // local-target merge without adding it to callback deps.
  const configRef = useRef<PiWebConfigResponse | undefined>(undefined);
  configRef.current = configResponse;
  // The selected-machine plugin config, read fresh inside togglePlugin to build
  // the enable/disable patch without adding it to callback deps.
  const pluginConfigRef = useRef<PiWebConfigResponse | undefined>(undefined);
  pluginConfigRef.current = pluginConfigResponse;
  // Latest lifecycle support, read fresh inside the plugin load/toggle handlers
  // (they gate on supportKey via deps, but read the object to reach .message).
  const lifecycleSupportRef = useRef(lifecycleSupport);
  lifecycleSupportRef.current = lifecycleSupport;
  // Latest package target, read fresh inside the package mutation handlers.
  const packageTargetRef = useRef(packageTarget);
  packageTargetRef.current = packageTarget;

  const showSaved = useCallback((): void => {
    setSavedMessage("配置已保存。");
    if (savedTimer.current !== undefined) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setSavedMessage((current) => (current === "配置已保存。" ? "" : current));
      savedTimer.current = undefined;
    }, 3000);
  }, []);

  const reloadConfig = useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const response = await configApi.config();
      if (seq !== loadSeq.current) return;
      setConfigResponse(response);
    } catch (err) {
      if (seq === loadSeq.current) setError(`加载配置失败：${errorMessage(err)}`);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  const reloadAccessConfig = useCallback(async (): Promise<void> => {
    const seq = ++accessSeq.current;
    const loadTarget = target;
    setAccessLoading(true);
    setAccessError("");
    try {
      const response = await configApi.config(loadTarget.id);
      if (seq !== accessSeq.current) return;
      setAccessConfigResponse(response);
    } catch (err) {
      if (seq === accessSeq.current) {
        setAccessError(
          `从 ${targetLabelText(loadTarget)} 加载文件访问/上传配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), loadTarget)}`,
        );
      }
    } finally {
      if (seq === accessSeq.current) setAccessLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target read fresh; targetId gates re-run
  }, [targetId]);

  const reloadSessiondConfig = useCallback(async (): Promise<void> => {
    const seq = ++sessiondSeq.current;
    const loadTarget = target;
    setSessiondLoading(true);
    setSessiondError("");
    try {
      const response = await configApi.config(loadTarget.id);
      if (seq !== sessiondSeq.current) return;
      setSessiondConfigResponse(response);
    } catch (err) {
      if (seq === sessiondSeq.current) {
        setSessiondError(
          `从 ${targetLabelText(loadTarget)} 加载会话守护进程配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), loadTarget)}`,
        );
      }
    } finally {
      if (seq === sessiondSeq.current) setSessiondLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target read fresh; targetId gates re-run
  }, [targetId]);

  const reloadPlugins = useCallback(async (): Promise<void> => {
    const seq = ++pluginSeq.current;
    const loadTarget = target;
    const support = lifecycleSupportRef.current;
    setPluginLoading(true);
    setPluginError("");
    try {
      // Unsupported machines can't produce a plugin lifecycle snapshot; still
      // load desired config so enablement stays editable, but surface why the
      // active-state list is missing.
      if (isSelectedMachineSettingsUnsupported(support)) {
        try {
          const config = await configApi.config(loadTarget.id);
          if (seq !== pluginSeq.current) return;
          setPluginConfigResponse(config);
          setPluginsResponse(undefined);
          setPluginError(support.message ?? `${targetLabelText(loadTarget)} 上不支持插件生命周期诊断。`);
        } catch (err) {
          if (seq !== pluginSeq.current) return;
          setPluginError(
            `从 ${targetLabelText(loadTarget)} 加载 PI WEB 插件配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), loadTarget)}；${support.message ?? "不支持插件生命周期诊断"}`,
          );
        }
        return;
      }

      const [config, plugins] = await Promise.allSettled([configApi.config(loadTarget.id), pluginsApi.plugins(loadTarget.id)]);
      if (seq !== pluginSeq.current) return;

      const errors: string[] = [];
      if (config.status === "fulfilled") setPluginConfigResponse(config.value);
      else errors.push(`config: ${friendlySelectedMachineSettingsErrorMessage(errorMessage(config.reason), loadTarget)}`);

      if (plugins.status === "fulfilled") setPluginsResponse(plugins.value);
      else errors.push(`PI WEB plugins: ${friendlySelectedMachineSettingsErrorMessage(errorMessage(plugins.reason), loadTarget)}`);

      setPluginError(
        errors.length === 0 ? "" : `从 ${targetLabelText(loadTarget)} 加载 PI WEB 插件设置失败：${errors.join("；")}`,
      );
    } finally {
      if (seq === pluginSeq.current) setPluginLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target/support read fresh; targetId+supportKey gate re-run
  }, [targetId, supportKey]);

  const reloadPackages = useCallback(async (): Promise<void> => {
    const seq = ++packageLoadSeq.current;
    const loadTarget = packageTargetRef.current;
    setPackageLoading(true);
    setPackageError("");
    setPackageMessage("");
    try {
      const result = await loadPiPackagesData(loadTarget, (machineId) => piPackagesApi.packages(machineId));
      if (seq !== packageLoadSeq.current) return;
      setPackagesResponse(result.packagesResponse);
      setPackageError(result.error);
    } finally {
      if (seq === packageLoadSeq.current) setPackageLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target read fresh; targetId gates re-run
  }, [targetId]);

  const runPiPackageMutation = useCallback(
    async (
      operation: PiPackageOperationState,
      label: string,
      mutate: (machineId: string) => Promise<PiPackageMutationResponse>,
    ): Promise<void> => {
      const mutateTarget = packageTargetRef.current;
      const seq = ++packageMutationSeq.current;
      // Bump the load counter so an in-flight reload discards its response.
      packageLoadSeq.current += 1;
      setPackageLoading(false);
      setSaving(true);
      setPackageOperation(operation);
      setPackageError("");
      setPackageMessage("");
      try {
        const response = await mutate(mutateTarget.id);
        if (seq !== packageMutationSeq.current) return;
        setPackagesResponse(piPackagesResponseAfterMutation(response));
        // A local install/remove/update can change the gateway plugin catalog;
        // refresh it so the plugins panel stays coherent (best-effort).
        if (shouldRefreshGatewayPluginsAfterPiPackageMutation(mutateTarget)) {
          try {
            const refreshed = await pluginsApi.plugins();
            if (seq === packageMutationSeq.current) setPluginsResponse(refreshed);
          } catch (err) {
            if (seq === packageMutationSeq.current) {
              setPackageError(`刷新网关 PI WEB 插件失败：${errorMessage(err)}`);
            }
          }
        }
        if (seq !== packageMutationSeq.current) return;
        setPackageMessage(piPackageFollowUpText(response.action, mutateTarget));
      } catch (err) {
        if (seq === packageMutationSeq.current) {
          setPackageError(`在 ${piPackageTargetLabelText(mutateTarget)} 上${label}：${friendlyPiPackageErrorText(errorMessage(err), mutateTarget)}`);
        }
        throw err;
      } finally {
        if (seq === packageMutationSeq.current) {
          setPackageOperation(undefined);
          setSaving(false);
        }
      }
    },
    [],
  );

  const installPiPackage = useCallback(
    (source: string): Promise<void> =>
      runPiPackageMutation({ kind: "install", source }, "安装 Pi 软件包失败", (machineId) => piPackagesApi.install(source, machineId)),
    [runPiPackageMutation],
  );

  const removePiPackage = useCallback(
    (source: string, scope: PiPackageScope): Promise<void> =>
      runPiPackageMutation({ kind: "remove", source }, "移除 Pi 软件包失败", (machineId) => piPackagesApi.remove(source, scope, machineId)),
    [runPiPackageMutation],
  );

  const updatePiPackage = useCallback(
    (source?: string): Promise<void> =>
      runPiPackageMutation(
        source === undefined ? { kind: "update-all" } : { kind: "update", source },
        "更新 Pi 软件包失败",
        (machineId) => piPackagesApi.update(source, machineId),
      ),
    [runPiPackageMutation],
  );
  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  // Access config (re)load on target change, resetting the prior target's state.
  useEffect(() => {
    setAccessConfigResponse(undefined);
    setAccessError("");
    setSavedMessage("");
    void reloadAccessConfig();
  }, [reloadAccessConfig]);

  // Sessiond config (re)load on target change.
  useEffect(() => {
    setSessiondConfigResponse(undefined);
    setSessiondError("");
    void reloadSessiondConfig();
  }, [reloadSessiondConfig]);

  // Plugins (re)load on target change or lifecycle-support change.
  useEffect(() => {
    setPluginConfigResponse(undefined);
    setPluginsResponse(undefined);
    setPluginError("");
    void reloadPlugins();
  }, [reloadPlugins]);

  // Packages (re)load on target change.
  useEffect(() => {
    setPackagesResponse(undefined);
    setPackageError("");
    setPackageMessage("");
    void reloadPackages();
  }, [reloadPackages]);

  useEffect(() => {
    return () => {
      if (savedTimer.current !== undefined) clearTimeout(savedTimer.current);
    };
  }, []);

  const saveConfig = useCallback(
    async (config: PiWebConfigValues): Promise<void> => {
      setSaving(true);
      setError("");
      setSavedMessage("");
      try {
        const response = await configApi.saveConfig(config);
        setConfigResponse(response);
        showSaved();
      } catch (err) {
        setError(`保存配置失败：${errorMessage(err)}`);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [showSaved],
  );

  const saveMachineAccessConfig = useCallback(
    async (config: PiWebConfigValues): Promise<void> => {
      const saveTarget = target;
      setSaving(true);
      setAccessError("");
      setSavedMessage("");
      try {
        const response = await configApi.saveConfig(config, saveTarget.id);
        setAccessConfigResponse(response);
        if (saveTarget.kind === "local" && configRef.current !== undefined) {
          setConfigResponse(mergeSelectedMachineAccessConfig(configRef.current, response));
        }
        showSaved();
      } catch (err) {
        setAccessError(
          `在 ${targetLabelText(saveTarget)} 上保存文件访问/上传配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), saveTarget)}`,
        );
        throw err;
      } finally {
        setSaving(false);
      }
       
    },
    [targetId, showSaved],
  );

  const saveSessiondConfig = useCallback(
    async (config: PiWebConfigValues): Promise<void> => {
      const saveTarget = target;
      setSaving(true);
      setSessiondError("");
      setSavedMessage("");
      try {
        const response = await configApi.saveConfig(config, saveTarget.id);
        setSessiondConfigResponse(response);
        if (saveTarget.kind === "local" && configRef.current !== undefined) {
          setConfigResponse(mergeSelectedMachineSessiondConfig(configRef.current, response));
        }
        showSaved();
      } catch (err) {
        setSessiondError(
          `在 ${targetLabelText(saveTarget)} 上保存会话守护进程配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), saveTarget)}`,
        );
        throw err;
      } finally {
        setSaving(false);
      }
       
    },
    [targetId, showSaved],
  );

  const togglePlugin = useCallback(
    async (pluginId: string, enabled: boolean): Promise<void> => {
      const saveTarget = target;
      const support = lifecycleSupportRef.current;
      const currentPluginConfig = pluginConfigRef.current;
      if (currentPluginConfig === undefined) {
        setPluginError(`${targetLabelText(saveTarget)} 的插件配置尚未加载。请先重新加载再更改插件启用状态。`);
        return;
      }
      const patch = pluginEnabledConfigPatch(currentPluginConfig.config, pluginId, enabled);
      setSaving(true);
      setPluginError("");
      setSavedMessage("");
      try {
        const response = await configApi.saveConfig(patch, saveTarget.id);
        setPluginConfigResponse(response);
        if (saveTarget.kind === "local" && configRef.current !== undefined) {
          setConfigResponse(mergeSelectedMachinePluginConfig(configRef.current, response));
        }
        // Refresh the active-plugin snapshot unless the machine can't produce
        // one; keep the desired-config save regardless.
        if (isSelectedMachineSettingsUnsupported(support)) {
          setPluginsResponse(undefined);
          setPluginError(support.message ?? `${targetLabelText(saveTarget)} 上不支持插件生命周期诊断。`);
        } else {
          try {
            const refreshed = await pluginsApi.plugins(saveTarget.id);
            setPluginsResponse(refreshed);
          } catch (err) {
            setPluginsResponse(undefined);
            setPluginError(
              `配置已保存，但从 ${targetLabelText(saveTarget)} 刷新 PI WEB 插件失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), saveTarget)}`,
            );
          }
        }
        showSaved();
      } catch (err) {
        setPluginError(
          `在 ${targetLabelText(saveTarget)} 上保存 PI WEB 插件配置失败：${friendlySelectedMachineSettingsErrorMessage(errorMessage(err), saveTarget)}`,
        );
      } finally {
        setSaving(false);
      }
       
    },
    [targetId, showSaved],
  );

  return {
    target,
    targetLabel: targetLabelText(target),
    configResponse,
    accessConfigResponse,
    loading,
    accessLoading,
    saving,
    error,
    accessError,
    savedMessage,
    reloadConfig,
    reloadAccessConfig,
    saveConfig,
    saveMachineAccessConfig,
    sessiondConfigResponse,
    sessiondLoading,
    sessiondError,
    reloadSessiondConfig,
    saveSessiondConfig,
    pluginConfigResponse,
    pluginsResponse,
    pluginLoading,
    pluginError,
    recoveryCommandsSupported: lifecycleSupport.state === "supported",
    reloadPlugins,
    togglePlugin,
    packagesResponse,
    packageTarget,
    packageLoading,
    packageOperation,
    packageError,
    packageMessage,
    reloadPackages,
    installPiPackage,
    removePiPackage,
    updatePiPackage,
  };
}
