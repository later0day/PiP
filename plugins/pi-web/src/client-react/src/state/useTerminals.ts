import { useCallback, useEffect, useRef, useState } from "react";
import { terminalsApi } from "@api/clients";
import type { TerminalInfo } from "@shared/apiTypes";
import type { TerminalCommandRun } from "@shared/pluginApiTypes";
import { selectFallbackTerminal, selectPreferredTerminal } from "@client/controllers/terminalSelection";

// Phase 5b: the workspace terminal list as a self-contained React hook. Ports
// the data half of the legacy <terminal-panel> (load terminals + command runs,
// create/close/continue, cancel command runs, pending-run polling) but owns its
// own local state rather than the god-object AppState. The xterm view lifecycle
// (socket I/O + fit) stays in the component. Scoped by machine/project/
// workspace; a scope change resets the list.

const COMMAND_RUN_POLL_INTERVAL_MS = 1000;

export interface TerminalScope {
  machineId: string;
  projectId: string;
  workspaceId: string;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalsController {
  terminals: TerminalInfo[];
  commandRuns: TerminalCommandRun[];
  loading: boolean;
  error: string | undefined;
  cancellingRunIds: string[];
  continuingTerminalIds: string[];
  refresh: () => void;
  startTerminal: (size?: TerminalSize) => Promise<TerminalInfo | undefined>;
  closeTerminal: (terminalId: string) => Promise<void>;
  continueTerminal: (terminalId: string) => Promise<TerminalInfo | undefined>;
  cancelCommandRun: (run: TerminalCommandRun) => Promise<void>;
  markExited: (terminalId: string, exitCode: number | undefined) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isCommandRunPending(run: TerminalCommandRun): boolean {
  return run.status === "queued" || run.status === "running";
}

export function commandRunCompletionLabel(run: TerminalCommandRun): string {
  if (run.status === "succeeded")
    return `命令执行成功${run.exitCode === undefined ? "" : `，退出码 ${String(run.exitCode)}`}`;
  return `命令执行失败${run.exitCode === undefined ? "" : `，退出码 ${String(run.exitCode)}`}`;
}

export function useTerminals(scope: TerminalScope | undefined): TerminalsController {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [commandRuns, setCommandRuns] = useState<TerminalCommandRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [cancellingRunIds, setCancellingRunIds] = useState<string[]>([]);
  const [continuingTerminalIds, setContinuingTerminalIds] = useState<string[]>([]);

  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const scopeKey = scope === undefined ? "" : `${scope.machineId}:${scope.projectId}:${scope.workspaceId}`;

  const sameScope = useCallback((s: TerminalScope): boolean => {
    const current = scopeRef.current;
    return (
      current?.machineId === s.machineId &&
      current.projectId === s.projectId &&
      current.workspaceId === s.workspaceId
    );
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== undefined) {
      clearInterval(pollTimer.current);
      pollTimer.current = undefined;
    }
  }, []);

  const loadCommandRuns = useCallback(async () => {
    const s = scopeRef.current;
    if (s === undefined) return;
    try {
      const runs = await terminalsApi.listCommandRuns({ projectId: s.projectId, workspaceId: s.workspaceId }, s.machineId);
      if (!sameScope(s)) return;
      setCommandRuns(runs);
      setCancellingRunIds((current) => current.filter((runId) => runs.some((run) => run.id === runId && isCommandRunPending(run))));
    } catch (cause) {
      if (!sameScope(s)) return;
      setError(errorMessage(cause));
    }
  }, [sameScope]);

  const startPolling = useCallback(() => {
    if (pollTimer.current !== undefined) return;
    pollTimer.current = setInterval(() => {
      void loadCommandRuns();
    }, COMMAND_RUN_POLL_INTERVAL_MS);
  }, [loadCommandRuns]);

  // Keep polling in sync with pending command runs.
  useEffect(() => {
    if (commandRuns.some(isCommandRunPending)) startPolling();
    else stopPolling();
  }, [commandRuns, startPolling, stopPolling]);

  const refresh = useCallback(() => {
    const s = scopeRef.current;
    if (s === undefined) return;
    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [nextTerminals, nextRuns] = await Promise.all([
          terminalsApi.terminals(s.projectId, s.workspaceId, s.machineId),
          terminalsApi.listCommandRuns({ projectId: s.projectId, workspaceId: s.workspaceId }, s.machineId),
        ]);
        if (!sameScope(s)) return;
        setTerminals(nextTerminals);
        setCommandRuns(nextRuns);
      } catch (cause) {
        if (!sameScope(s)) return;
        setError(errorMessage(cause));
      } finally {
        if (sameScope(s)) setLoading(false);
      }
    })();
  }, [sameScope]);

  const startTerminal = useCallback(
    async (size?: TerminalSize): Promise<TerminalInfo | undefined> => {
      const s = scopeRef.current;
      if (s === undefined) return undefined;
      setError(undefined);
      try {
        const terminal = await terminalsApi.startTerminal(s.projectId, s.workspaceId, size, s.machineId);
        if (!sameScope(s)) return undefined;
        setTerminals((current) => [...current, terminal]);
        return terminal;
      } catch (cause) {
        if (sameScope(s)) setError(errorMessage(cause));
        return undefined;
      }
    },
    [sameScope],
  );

  const closeTerminal = useCallback(
    async (terminalId: string): Promise<void> => {
      const s = scopeRef.current;
      if (s === undefined) return;
      try {
        await terminalsApi.closeTerminal(s.projectId, s.workspaceId, terminalId, s.machineId);
        if (!sameScope(s)) return;
        setTerminals((current) => current.filter((terminal) => terminal.id !== terminalId));
      } catch (cause) {
        if (sameScope(s)) setError(errorMessage(cause));
      }
    },
    [sameScope],
  );

  const continueTerminal = useCallback(
    async (terminalId: string): Promise<TerminalInfo | undefined> => {
      const s = scopeRef.current;
      if (s === undefined) return undefined;
      const guard = { hit: false };
      setContinuingTerminalIds((current) => {
        if (current.includes(terminalId)) {
          guard.hit = true;
          return current;
        }
        return [...current, terminalId];
      });
      if (guard.hit) return undefined;
      setError(undefined);
      try {
        const terminal = await terminalsApi.continueTerminal(s.projectId, s.workspaceId, terminalId, s.machineId);
        if (!sameScope(s)) return undefined;
        setTerminals((current) => current.map((item) => (item.id === terminalId ? terminal : item)));
        return terminal;
      } catch (cause) {
        if (sameScope(s)) setError(errorMessage(cause));
        return undefined;
      } finally {
        setContinuingTerminalIds((current) => current.filter((id) => id !== terminalId));
      }
    },
    [sameScope],
  );

  const cancelCommandRun = useCallback(
    async (run: TerminalCommandRun): Promise<void> => {
      const s = scopeRef.current;
      if (s === undefined || !isCommandRunPending(run)) return;
      const guard = { hit: false };
      setCancellingRunIds((current) => {
        if (current.includes(run.id)) {
          guard.hit = true;
          return current;
        }
        return [...current, run.id];
      });
      if (guard.hit) return;
      setError(undefined);
      try {
        await terminalsApi.cancelCommandRun(run.id, s.machineId);
        await loadCommandRuns();
      } catch (cause) {
        if (sameScope(s)) setError(errorMessage(cause));
      } finally {
        setCancellingRunIds((current) => current.filter((runId) => runId !== run.id));
      }
    },
    [loadCommandRuns, sameScope],
  );

  const markExited = useCallback((terminalId: string, exitCode: number | undefined) => {
    setTerminals((current) =>
      current.map((item) =>
        item.id === terminalId ? { ...item, exited: true, ...(exitCode === undefined ? {} : { exitCode }) } : item,
      ),
    );
    void loadCommandRuns();
  }, [loadCommandRuns]);

  // Reset + reload when the workspace scope changes.
  useEffect(() => {
    setTerminals([]);
    setCommandRuns([]);
    setError(undefined);
    setCancellingRunIds([]);
    setContinuingTerminalIds([]);
    stopPolling();
    if (scopeKey !== "") refresh();
    // scopeKey identifies the scope; refresh reads scopeRef for freshness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Stop polling on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  return {
    terminals,
    commandRuns,
    loading,
    error,
    cancellingRunIds,
    continuingTerminalIds,
    refresh,
    startTerminal,
    closeTerminal,
    continueTerminal,
    cancelCommandRun,
    markExited,
  };
}

export { selectFallbackTerminal, selectPreferredTerminal };
