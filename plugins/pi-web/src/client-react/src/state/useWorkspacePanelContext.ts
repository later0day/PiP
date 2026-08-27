import { useMemo } from "react";
import { workspacesApi, terminalsApi } from "@api/clients";
import type { AppState } from "@client/appState";
import { createWorkspaceFiles } from "@client/plugins/workspaceFiles";
import { createPluginWorkspaceBackend } from "@client/plugins/workspaceBackend";
import { createTerminalCommandRunsRuntime } from "@client/runtime/terminalRuntime";
import { installWorkspacePanelScope } from "@client/plugins/registry";
import { workspaceEffectiveUploadFolder } from "@client/api/workspaceUploads";
import type {
  PluginMachine,
  PluginPromptEditor,
  WorkspacePanelContext,
  WorkspacePluginBinding,
} from "@client/plugins/types";
import type { Workspace } from "@shared/apiTypes";
import type { FileExplorerController } from "./useFileExplorer";
import type { TerminalsController } from "./useTerminals";

// Phase 5c: assembles the WorkspacePanelContext that plugin-contributed panels
// (via the Lit interop bridge) consume. Mirrors the legacy
// PiWebApp.createWorkspacePanelContext but sources the file/terminal slices from
// the native React explorer + terminals controllers rather than the god-object.
// The framework-agnostic helpers (createWorkspaceFiles / workspaceBackend /
// terminalRuntime / installWorkspacePanelScope) are reused verbatim.

export interface WorkspacePanelContextInputs {
  machineId: string;
  workspace: Workspace;
  state: AppState;
  explorer: FileExplorerController;
  terminals: TerminalsController;
  uploadDefaultFolder: string;
  onSelectTerminal: (terminalId: string | undefined, options?: { replace?: boolean }) => void;
  requestRender: () => void;
}

function pluginMachineFromState(state: AppState, machineId: string): PluginMachine {
  const machine = state.selectedMachine;
  if (machine?.id === machineId) return { id: machine.id, name: machine.name, kind: machine.kind };
  return { id: machineId, name: machineId, kind: "local" };
}

function coreWorkspacePluginBinding(): WorkspacePluginBinding {
  return { registrationPluginId: "core", sourcePluginId: "core" };
}

function createNoopPromptEditor(): PluginPromptEditor {
  // The prompt editor lives in the chat composer; plugin panels that only read
  // files/backend never touch it. Wiring it to the live CodeMirror composer is
  // a later cross-panel increment.
  return {
    insertText: () => undefined,
    getText: () => "",
    getSelection: () => null,
  };
}

export function useWorkspacePanelContext(inputs: WorkspacePanelContextInputs | undefined): WorkspacePanelContext | undefined {
  return useMemo<WorkspacePanelContext | undefined>(() => {
    if (inputs === undefined) return undefined;
    const { machineId, workspace, state, explorer, terminals, uploadDefaultFolder, onSelectTerminal, requestRender } = inputs;
    const machine = pluginMachineFromState(state, machineId);

    const createContext = (binding: WorkspacePluginBinding): WorkspacePanelContext => {
      const terminalCommandRuns = createTerminalCommandRunsRuntime(binding.registrationPluginId, {
        api: {
          runTerminalCommand: (origin, input) => terminalsApi.runTerminalCommand(origin, input, machineId),
          listCommandRuns: (filter) => terminalsApi.listCommandRuns(filter, machineId),
          getCommandRun: (runId) => terminalsApi.getCommandRun(runId, machineId),
        },
        openTerminal: (_ws, options) => {
          onSelectTerminal(options?.terminalId, { replace: true });
        },
      });
      const backend = createPluginWorkspaceBackend(binding, workspace, machineId);

      return installWorkspacePanelScope(
        {
          machine,
          workspace,
          state,
          files: createWorkspaceFiles(workspacesApi, workspace, machineId, () => {
            explorer.refreshFiles();
          }),
          ...(backend === undefined ? {} : { backend }),
          prompt: createNoopPromptEditor(),
          terminal: {
            open: (options) => {
              onSelectTerminal(options?.terminalId, { replace: true });
            },
            runCommand: (input) => terminalCommandRuns.runCommand({ ...input, workspace }),
          },
          openTerminal: (options) => {
            onSelectTerminal(options?.terminalId, { replace: true });
          },
          host: { requestRender },
          piWebUnstable: { terminalCommandRuns },
          fileTree: explorer.fileTree,
          expandedDirs: explorer.expandedDirs,
          selectedFilePath: explorer.selectedFilePath,
          selectedFileContent: explorer.selectedFileContent,
          selectedFileLoadError: explorer.selectedFileLoadError,
          fileTreeStale: explorer.fileTreeStale,
          activeTerminalCount: terminals.terminals.filter((terminal) => !terminal.exited).length,
          selectedTerminalId: undefined,
          terminalAutoStart: false,
          workspaceUploadDefaultFolder: workspaceEffectiveUploadFolder(workspace.effectiveConfig, uploadDefaultFolder),
          onRefreshFiles: () => {
            explorer.refreshFiles();
          },
          onExpandDir: (path) => {
            explorer.expandDir(path);
          },
          onSelectFile: (path) => {
            explorer.selectFile(path);
          },
          onStartWorkspaceUpload: (files, options) => {
            explorer.startUpload(files, options);
            return undefined;
          },
          onCancelWorkspaceUpload: (batchId) => {
            explorer.cancelUpload(batchId);
          },
          onClearWorkspaceUpload: (batchId) => {
            explorer.clearUpload(batchId);
          },
          onSelectTerminal,
        },
        createContext,
      );
    };

    return createContext(coreWorkspacePluginBinding());
    // The context is a fresh snapshot each render-inputs change; downstream
    // panels re-render via their own onInvalidate + host.requestRender.
  }, [inputs]);
}
