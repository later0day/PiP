import { useCallback, useEffect, useRef, useState } from "react";
import { workspacesApi } from "@api/clients";
import {
  uploadWorkspaceFiles as defaultUploadWorkspaceFiles,
  WorkspaceUploadBatchError,
  WorkspaceUploadCancelledError,
  type WorkspaceUploadTask,
} from "@client/api/workspaceUploads";
import type { WriteWorkspaceFileResponse } from "@shared/apiTypes";
import {
  cancelWorkspaceUploadBatch,
  completeWorkspaceUploadBatch,
  createWorkspaceUploadBatchState,
  failWorkspaceUploadBatch,
  updateWorkspaceUploadBatchProgress,
  type WorkspaceUploadBatchState,
} from "@client/workspaceUploadState";
import type { FileContentResponse, FileTreeEntry } from "@shared/pluginApiTypes";

// Phase 5a: the workspace file explorer as a self-contained React hook. Ports
// the legacy FileExplorerController's tree / expand / select / upload logic
// (generation-guarded file loads, expand toggling, upload batch lifecycle) but
// owns its own local state rather than the god-object AppState. Scoped by
// machine/project/workspace; a scope change resets the tree + selection.

export interface FileExplorerScope {
  machineId: string;
  projectId: string;
  workspaceId: string;
}

export interface StartUploadOptions {
  destinationFolder: string;
  createDirs?: boolean;
  overwrite?: boolean;
  selectUploadedFile?: boolean;
}

export interface FileExplorerController {
  fileTree: FileTreeEntry[];
  expandedDirs: Record<string, FileTreeEntry[]>;
  fileTreeStale: boolean;
  selectedFilePath: string | undefined;
  selectedFileContent: FileContentResponse | undefined;
  selectedFileLoadError: string | undefined;
  uploadBatches: WorkspaceUploadBatchState[];
  error: string | undefined;
  refreshFiles: () => void;
  expandDir: (path: string) => void;
  selectFile: (path: string) => void;
  startUpload: (files: readonly File[], options: StartUploadOptions) => void;
  cancelUpload: (batchId: string) => void;
  clearUpload: (batchId: string) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function omitKey<T>(record: Record<string, T>, keyToOmit: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== keyToOmit));
}

export function useFileExplorer(scope: FileExplorerScope | undefined): FileExplorerController {
  const [fileTree, setFileTree] = useState<FileTreeEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, FileTreeEntry[]>>({});
  const [fileTreeStale, setFileTreeStale] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>(undefined);
  const [selectedFileContent, setSelectedFileContent] = useState<FileContentResponse | undefined>(undefined);
  const [selectedFileLoadError, setSelectedFileLoadError] = useState<string | undefined>(undefined);
  const [uploadBatchMap, setUploadBatchMap] = useState<Record<string, WorkspaceUploadBatchState>>({});
  const [error, setError] = useState<string | undefined>(undefined);

  // Refs for stable callbacks + stale-request guards.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const expandedRef = useRef(expandedDirs);
  expandedRef.current = expandedDirs;
  const fileGenerationRef = useRef(0);
  const uploadTasks = useRef(new Map<string, WorkspaceUploadTask<WriteWorkspaceFileResponse[]>>());
  const uploadSeq = useRef(0);
  const scopeKey = scope === undefined ? "" : `${scope.machineId}:${scope.projectId}:${scope.workspaceId}`;

  const sameScope = useCallback((s: FileExplorerScope): boolean => {
    const current = scopeRef.current;
    return (
      current?.machineId === s.machineId &&
      current.projectId === s.projectId &&
      current.workspaceId === s.workspaceId
    );
  }, []);

  const refreshFiles = useCallback(() => {
    const s = scopeRef.current;
    if (s === undefined) return;
    void (async () => {
      try {
        const root = await workspacesApi.workspaceTree(s.projectId, s.workspaceId, "", s.machineId);
        const expanded = { ...expandedRef.current };
        await Promise.all(
          Object.keys(expanded).map(async (path) => {
            expanded[path] = (await workspacesApi.workspaceTree(s.projectId, s.workspaceId, path, s.machineId)).entries;
          }),
        );
        if (!sameScope(s)) return;
        setFileTree(root.entries);
        setExpandedDirs(expanded);
        setFileTreeStale(false);
        setError(undefined);
      } catch (cause) {
        if (!sameScope(s)) return;
        setError(errorMessage(cause));
      }
    })();
  }, [sameScope]);

  const expandDir = useCallback(
    (path: string) => {
      const s = scopeRef.current;
      if (s === undefined) return;
      if (expandedRef.current[path] !== undefined) {
        setExpandedDirs((current) => omitKey(current, path));
        return;
      }
      void (async () => {
        try {
          const response = await workspacesApi.workspaceTree(s.projectId, s.workspaceId, path, s.machineId);
          if (!sameScope(s)) return;
          setExpandedDirs((current) => ({ ...current, [path]: response.entries }));
          setError(undefined);
        } catch (cause) {
          if (!sameScope(s)) return;
          setError(errorMessage(cause));
        }
      })();
    },
    [sameScope],
  );

  const restoreFile = useCallback(
    (path: string) => {
      const s = scopeRef.current;
      if (s === undefined) return;
      const generation = ++fileGenerationRef.current;
      const isCurrent = (): boolean => generation === fileGenerationRef.current && sameScope(s);
      setSelectedFilePath(path);
      setSelectedFileContent(undefined);
      setSelectedFileLoadError(undefined);
      void (async () => {
        try {
          const content = await workspacesApi.workspaceFile(s.projectId, s.workspaceId, path, s.machineId);
          if (!isCurrent()) return;
          setSelectedFileContent(content);
          setSelectedFileLoadError(undefined);
          setError(undefined);
        } catch (cause) {
          if (!isCurrent()) return;
          setSelectedFileContent(undefined);
          setSelectedFileLoadError(errorMessage(cause));
        }
      })();
    },
    [sameScope],
  );

  const selectFile = useCallback(
    (path: string) => {
      restoreFile(path);
    },
    [restoreFile],
  );

  const setUploadBatch = useCallback((batch: WorkspaceUploadBatchState) => {
    setUploadBatchMap((current) => ({ ...current, [batch.id]: batch }));
  }, []);

  const startUpload = useCallback(
    (files: readonly File[], options: StartUploadOptions) => {
      const s = scopeRef.current;
      if (s === undefined) {
        setError("请先选择工作区再上传文件。");
        return;
      }
      if (files.length === 0) return;
      const overwrite = options.overwrite ?? false;
      const createDirs = options.createDirs ?? true;
      let batch: WorkspaceUploadBatchState;
      try {
        uploadSeq.current += 1;
        batch = createWorkspaceUploadBatchState({
          id: `workspace-upload-${String(uploadSeq.current)}`,
          projectId: s.projectId,
          workspaceId: s.workspaceId,
          machineId: s.machineId,
          destinationFolder: options.destinationFolder,
          overwrite,
          createDirs,
          files,
          startedAt: new Date().toISOString(),
        });
      } catch (cause) {
        setError(errorMessage(cause));
        return;
      }
      setUploadBatch(batch);

      const batchScope = s;
      const isCurrentBatch = (): boolean => sameScope(batchScope);
      const failBatch = (cause: unknown): void => {
        setUploadBatchMap((current) => {
          const existing = current[batch.id];
          if (existing?.status !== "uploading") return current;
          if (cause instanceof WorkspaceUploadCancelledError) {
            return { ...current, [batch.id]: cancelWorkspaceUploadBatch(existing, new Date().toISOString()) };
          }
          const message = errorMessage(cause);
          setError(message);
          return { ...current, [batch.id]: failWorkspaceUploadBatch(existing, message, new Date().toISOString()) };
        });
      };

      let task: WorkspaceUploadTask<WriteWorkspaceFileResponse[]>;
      try {
        task = defaultUploadWorkspaceFiles(s.projectId, s.workspaceId, files, {
          destinationFolder: options.destinationFolder,
          machineId: s.machineId,
          overwrite,
          createDirs,
          onProgress: (progress) => {
            setUploadBatchMap((current) => {
              const existing = current[batch.id];
              if (existing?.status !== "uploading") return current;
              return { ...current, [batch.id]: updateWorkspaceUploadBatchProgress(existing, progress) };
            });
          },
        });
      } catch (cause) {
        failBatch(cause);
        return;
      }

      uploadTasks.current.set(batch.id, task);
      void task.promise
        .then((responses) => {
          setUploadBatchMap((current) => {
            const existing = current[batch.id];
            if (existing?.status !== "uploading") return current;
            return { ...current, [batch.id]: completeWorkspaceUploadBatch(existing, responses, new Date().toISOString()) };
          });
          setError(undefined);
          if (!isCurrentBatch()) return;
          refreshFiles();
          const uploadedPath = responses[0]?.path;
          if (options.selectUploadedFile !== false && uploadedPath !== undefined && isCurrentBatch()) selectFile(uploadedPath);
        })
        .catch((cause: unknown) => {
          failBatch(cause);
          if (
            cause instanceof WorkspaceUploadBatchError &&
            cause.responses.length > 0 &&
            isCurrentBatch()
          ) {
            refreshFiles();
            const uploadedPath = cause.responses[0]?.path;
            if (options.selectUploadedFile !== false && uploadedPath !== undefined && isCurrentBatch()) selectFile(uploadedPath);
          }
        })
        .finally(() => {
          uploadTasks.current.delete(batch.id);
        });
    },
    [refreshFiles, sameScope, selectFile, setUploadBatch],
  );

  const cancelUpload = useCallback((batchId: string) => {
    setUploadBatchMap((current) => {
      const existing = current[batchId];
      if (existing?.status !== "uploading") return current;
      return { ...current, [batchId]: cancelWorkspaceUploadBatch(existing, new Date().toISOString()) };
    });
    uploadTasks.current.get(batchId)?.cancel();
  }, []);

  const clearUpload = useCallback((batchId: string) => {
    uploadTasks.current.get(batchId)?.cancel();
    uploadTasks.current.delete(batchId);
    setUploadBatchMap((current) => omitKey(current, batchId));
  }, []);

  // Reset + reload when the workspace scope changes.
  useEffect(() => {
    setFileTree([]);
    setExpandedDirs({});
    setFileTreeStale(false);
    setSelectedFilePath(undefined);
    setSelectedFileContent(undefined);
    setSelectedFileLoadError(undefined);
    setError(undefined);
    if (scopeKey !== "") refreshFiles();
    // scopeKey identifies the scope; refreshFiles reads scopeRef for freshness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const uploadBatches = Object.values(uploadBatchMap).sort((left, right) => right.startedAt.localeCompare(left.startedAt));

  return {
    fileTree,
    expandedDirs,
    fileTreeStale,
    selectedFilePath,
    selectedFileContent,
    selectedFileLoadError,
    uploadBatches,
    error,
    refreshFiles,
    expandDir,
    selectFile,
    startUpload,
    cancelUpload,
    clearUpload,
  };
}
