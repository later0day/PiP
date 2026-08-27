import { type JSX, useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import type { Workspace } from "@shared/apiTypes";
import { effectiveWorkspaceUploadFolder } from "@client/api/workspaceUploads";
import { WorkspaceFilesPanel } from "./WorkspaceFilesPanel";
import { TerminalPanel } from "./TerminalPanel";
import { LitPanelHost } from "./LitPanelHost";
import { useAppState } from "../../state/appStore";
import { useFileExplorer, type FileExplorerScope } from "../../state/useFileExplorer";
import { useTerminals, type TerminalScope } from "../../state/useTerminals";
import { usePlugins } from "../../state/usePlugins";
import { useWorkspacePanelContext } from "../../state/useWorkspacePanelContext";
import styles from "./WorkspacePanel.module.css";

// Phase 5: the workspace panel host. Ports the legacy <workspace-panel> tab
// strip + panel-content frame, driving the two core tools (Files + Terminal,
// both native React) plus any plugin-contributed panels (apiVersion:2) rendered
// through the Lit interop bridge (<LitPanelHost>). Core panels are native; a
// plugin panel's tab id is its QualifiedContributionId.

export type WorkspaceTool = "files" | "terminal";

export interface WorkspacePanelProps {
  machineId: string;
  workspace: Workspace | undefined;
  /** The active tool id from the route (raw view/tool value). */
  activeToolId: string | undefined;
  onSelectTool: (toolId: string) => void;
}

interface CoreTab {
  id: WorkspaceTool;
  title: string;
  icon: string;
}

const CORE_TABS: CoreTab[] = [
  { id: "files", title: "文件", icon: "🗂" },
  { id: "terminal", title: "终端", icon: "⌨" },
];

function resolveCoreTool(value: string | undefined): WorkspaceTool | undefined {
  if (value === "files" || value === "core:workspace.files") return "files";
  if (value === "terminal" || value === "core:workspace.terminal") return "terminal";
  return undefined;
}

export function WorkspacePanel({ machineId, workspace, activeToolId, onSelectTool }: WorkspacePanelProps): JSX.Element {
  const state = useAppState();
  const [renderNonce, setRenderNonce] = useState(0);
  const requestRender = useCallback(() => {
    setRenderNonce((value) => value + 1);
  }, []);

  const fileScope = useMemo<FileExplorerScope | undefined>(
    () =>
      workspace === undefined ? undefined : { machineId, projectId: workspace.projectId, workspaceId: workspace.id },
    [machineId, workspace],
  );
  const terminalScope = useMemo<TerminalScope | undefined>(
    () =>
      workspace === undefined ? undefined : { machineId, projectId: workspace.projectId, workspaceId: workspace.id },
    [machineId, workspace],
  );
  const explorer = useFileExplorer(fileScope);
  const terminals = useTerminals(terminalScope);
  const { workspacePanels } = usePlugins();
  // Terminal selection lives locally; the URL round-trip is deferred to polish.
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | undefined>(undefined);

  const uploadDefaultFolder = workspace === undefined ? "" : effectiveWorkspaceUploadFolder(workspace.effectiveConfig);

  const onSelectTerminal = useCallback(
    (terminalId: string | undefined) => {
      setSelectedTerminalId(terminalId);
    },
    [],
  );

  const contextInputs = useMemo(
    () =>
      workspace === undefined
        ? undefined
        : {
            machineId,
            workspace,
            state,
            explorer,
            terminals,
            uploadDefaultFolder,
            onSelectTerminal,
            requestRender,
          },
    [machineId, workspace, state, explorer, terminals, uploadDefaultFolder, onSelectTerminal, requestRender],
  );
  const panelContext = useWorkspacePanelContext(contextInputs);

  if (workspace === undefined) {
    return (
      <section className={styles.emptyState} role="status">
        <h2>选择工作区</h2>
        <p>选择一个工作区以使用其工具。</p>
      </section>
    );
  }

  // Resolve the active tab: a core tool, a plugin panel id, or the files default.
  const coreTool = resolveCoreTool(activeToolId);
  const activePluginPanel =
    coreTool === undefined && activeToolId !== undefined
      ? workspacePanels.find(
          (panel) => panel.id === activeToolId || panel.routeAliases?.includes(activeToolId) === true,
        )
      : undefined;
  const activeCoreTool: WorkspaceTool = coreTool ?? (activePluginPanel === undefined ? "files" : "files");
  const activeId = activePluginPanel?.id ?? activeCoreTool;

  const visiblePluginPanels = panelContext === undefined
    ? []
    : workspacePanels.filter((panel) => panel.visible?.(panelContext) ?? true);

  return (
    <div className={styles.host}>
      <header className={styles.header}>
        <div className={styles.tabs} role="tablist">
          {CORE_TABS.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={clsx(styles.tab, selected && styles.tabSelected)}
                onClick={() => {
                  onSelectTool(tab.id);
                }}
              >
                <span className={styles.tabIcon} aria-hidden="true">
                  {tab.icon}
                </span>
                <span className={styles.tabLabel}>{tab.title}</span>
              </button>
            );
          })}
          {visiblePluginPanels.map((panel) => {
            const selected = panel.id === activeId;
            const badge = panelContext === undefined ? undefined : panel.badge?.(panelContext);
            return (
              <button
                key={panel.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={clsx(styles.tab, selected && styles.tabSelected)}
                onClick={() => {
                  onSelectTool(panel.id);
                }}
              >
                <span className={styles.tabLabel}>{panel.title}</span>
                {typeof badge === "string" || typeof badge === "number" ? (
                  <span className={styles.tabBadge}>{badge}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>
      <div className={styles.panelContent} data-render-nonce={renderNonce}>
        {activePluginPanel !== undefined && panelContext !== undefined ? (
          <LitPanelHost template={activePluginPanel.render(panelContext)} />
        ) : activeCoreTool === "files" ? (
          <WorkspaceFilesPanel
            machineId={machineId}
            projectId={workspace.projectId}
            workspaceId={workspace.id}
            uploadDefaultFolder={uploadDefaultFolder}
            explorer={explorer}
          />
        ) : (
          <TerminalPanel
            machineId={machineId}
            projectId={workspace.projectId}
            workspaceId={workspace.id}
            selectedTerminalId={selectedTerminalId}
            onSelectTerminal={onSelectTerminal}
          />
        )}
      </div>
    </div>
  );
}
