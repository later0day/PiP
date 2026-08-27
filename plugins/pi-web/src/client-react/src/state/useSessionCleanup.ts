import { useCallback, useRef, useState } from "react";
import { sessionsApi } from "@api/clients";
import type { SessionCleanupExecuteResponse, SessionCleanupPreviewResponse, SessionCleanupRequest } from "@shared/apiTypes";
import { sessionCleanupRequestKey } from "@client/sessionCleanupUi";
import { useAppState } from "./appStore";
import { useController } from "./AppProvider";

// useSessionCleanup — the React port of PiWebApp's session-cleanup handlers
// (openSessionCleanupDialog / previewSessionCleanup / runSessionCleanup /
// closeSessionCleanupDialog). It owns the dialog's open flag + preview/result
// state, scopes every request to the selected machine, and discards responses
// whose machine no longer matches the selection (the legacy selectedMachineId
// staleness guard). After a successful run it refreshes the current workspace's
// session list so the freed sessions disappear. The dialog itself reuses the
// pure sessionCleanupUi module for validation/selection/confirmation.

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SessionCleanupState {
  open: boolean;
  preview: SessionCleanupPreviewResponse | undefined;
  previewRequest: SessionCleanupRequest | undefined;
  result: SessionCleanupExecuteResponse | undefined;
  loading: boolean;
  running: boolean;
  error: string;
  openDialog: () => void;
  closeDialog: () => void;
  preview_: (request: SessionCleanupRequest) => Promise<void>;
  run: (request: SessionCleanupRequest) => Promise<void>;
}

export function useSessionCleanup(): SessionCleanupState {
  const state = useAppState();
  const controller = useController();
  const machineId = state.selectedMachine?.id ?? "local";
  const machineRef = useRef(machineId);
  machineRef.current = machineId;

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SessionCleanupPreviewResponse | undefined>(undefined);
  const [previewRequest, setPreviewRequest] = useState<SessionCleanupRequest | undefined>(undefined);
  const [result, setResult] = useState<SessionCleanupExecuteResponse | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  // The threshold+request used for the current preview, read fresh inside run()
  // to reject a run whose thresholds drifted from the preview (legacy guard).
  const previewRequestRef = useRef<SessionCleanupRequest | undefined>(undefined);
  previewRequestRef.current = previewRequest;

  const openDialog = useCallback((): void => {
    setOpen(true);
    setPreview(undefined);
    setPreviewRequest(undefined);
    setResult(undefined);
    setLoading(false);
    setRunning(false);
    setError("");
  }, []);

  const closeDialog = useCallback((): void => {
    setOpen(false);
  }, []);

  const preview_ = useCallback(async (request: SessionCleanupRequest): Promise<void> => {
    const requestMachine = machineRef.current;
    setLoading(true);
    setError("");
    setPreview(undefined);
    setPreviewRequest(undefined);
    setResult(undefined);
    try {
      const response = await sessionsApi.cleanupPreview(request, requestMachine);
      if (machineRef.current !== requestMachine) return;
      setPreview(response);
      setPreviewRequest(request);
      setResult(undefined);
    } catch (err) {
      if (machineRef.current === requestMachine) setError(`预览清理失败：${errorMessage(err)}`);
    } finally {
      if (machineRef.current === requestMachine) setLoading(false);
    }
  }, []);

  const run = useCallback(
    async (request: SessionCleanupRequest): Promise<void> => {
      const requestMachine = machineRef.current;
      if (sessionCleanupRequestKey(previewRequestRef.current) !== sessionCleanupRequestKey(request)) {
        setError("请先预览清理再执行。");
        return;
      }
      setRunning(true);
      setError("");
      try {
        const response = await sessionsApi.cleanup(request, requestMachine);
        if (machineRef.current !== requestMachine) return;
        setPreview(response);
        setPreviewRequest(request);
        setResult(response);
        // Refresh the current workspace's session list so freed sessions drop.
        const cwd = state.selectedWorkspace?.path;
        if (cwd !== undefined) void controller.loadSessions(cwd, requestMachine);
      } catch (err) {
        if (machineRef.current === requestMachine) setError(`执行清理失败：${errorMessage(err)}`);
      } finally {
        if (machineRef.current === requestMachine) setRunning(false);
      }
    },
    [controller, state.selectedWorkspace],
  );

  return { open, preview, previewRequest, result, loading, running, error, openDialog, closeDialog, preview_, run };
}
