import { useMemo } from "react";
import type { AppAction } from "@client/actions";
import { useAppState, useSetState } from "./appStore";
import { useController } from "./AppProvider";
import { useRoute } from "./useRoute";

// useActions — assemble the real AppAction list the command palette runs.
// Mirrors the legacy PiWebApp.getDefaultActions() surfaces that are wired in the
// React tree today (add project/machine, appearance, new chat, refresh, session
// cleanup). Each action is enabled/disabled from live state and its run()
// dispatches through the same seams the UI triggers use. Plugin-contributed
// actions + shortcut-preference remap are deferred to a later increment.

export interface UseActionsInput {
  /** Open the appearance picker (owned locally by ContextBar). */
  onOpenTheme: () => void;
  /** Open the session-cleanup dialog (owned by useSessionCleanup in ContextBar). */
  onOpenCleanup: () => void;
  /** Open the sessions table overlay (owned locally by ContextBar). */
  onOpenSessions: () => void;
  /** Open the login flow (owned by useAuth in ContextBar). */
  onLogin: () => void;
  /** Open the logout flow (owned by useAuth in ContextBar). */
  onLogout: () => void;
}

export function useActions({ onOpenTheme, onOpenCleanup, onOpenSessions, onLogin, onLogout }: UseActionsInput): AppAction[] {
  const state = useAppState();
  const setState = useSetState();
  const { navigate } = useRoute();
  const controller = useController();

  return useMemo<AppAction[]>(() => {
    const hasWorkspace = state.selectedWorkspace !== undefined;
    return [
      {
        id: "app.chat.new",
        title: "新建会话",
        description: "在选中的工作区开启新对话",
        group: "对话",
        run: () => { navigate({ sessionId: undefined, view: "chat" }); },
      },
      {
        id: "app.project.add",
        title: "添加项目",
        description: "按文件夹路径添加或打开项目",
        group: "导航",
        run: () => { setState({ projectDialogOpen: true }); },
      },
      {
        id: "app.machine.add",
        title: "添加机器",
        description: "将远程 PI WEB 机器接入集群",
        group: "导航",
        run: () => { setState({ machineDialogOpen: true }); },
      },
      {
        id: "app.appearance",
        title: "切换外观",
        description: "在自动、浅色、深色主题间切换",
        group: "视图",
        run: () => { onOpenTheme(); },
      },
      {
        id: "core:workspace.open-files",
        title: "打开文件面板",
        description: "显示工作区文件浏览器",
        group: "工作区",
        enabled: hasWorkspace,
        disabledReason: hasWorkspace ? undefined : "请先选择工作区",
        run: () => { navigate({ view: "files", tool: "files" }, { replace: true }); },
      },
      {
        id: "core:workspace.open-terminal",
        title: "打开终端面板",
        description: "显示工作区终端",
        group: "工作区",
        enabled: hasWorkspace,
        disabledReason: hasWorkspace ? undefined : "请先选择工作区",
        run: () => { navigate({ view: "terminal", tool: "terminal" }, { replace: true }); },
      },
      {
        id: "app.machines.reload",
        title: "重新加载机器",
        description: "从网关刷新机器集群",
        group: "导航",
        run: () => {
          void controller.loadMachines();
        },
      },
      {
        id: "app.sessions.browse",
        title: "浏览会话",
        description: "筛选并排序选中工作区中的会话",
        group: "会话",
        enabled: hasWorkspace,
        disabledReason: hasWorkspace ? undefined : "请先选择工作区",
        run: () => { onOpenSessions(); },
      },
      {
        id: "app.sessions.cleanup",
        title: "清理会话",
        description: "归档空闲会话，或永久删除旧的已归档会话",
        group: "会话",
        run: () => { onOpenCleanup(); },
      },
      {
        id: "app.auth.login",
        title: "登录服务商",
        description: "在选中机器上认证订阅或 API 密钥服务商",
        group: "账户",
        run: () => { onLogin(); },
      },
      {
        id: "app.auth.logout",
        title: "退出服务商",
        description: "移除选中机器上存储的服务商凭据",
        group: "账户",
        run: () => { onLogout(); },
      },
    ];
  }, [state.selectedWorkspace, setState, navigate, controller, onOpenTheme, onOpenCleanup, onOpenSessions, onLogin, onLogout]);
}
