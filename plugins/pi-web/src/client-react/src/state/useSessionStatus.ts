import { useEffect, useRef, useState } from "react";
import { sessionsApi } from "@api/clients";
import { SessionSocket, type SessionUiEvent } from "@client/sessionSocket";
import type { SessionRef, SessionStatus } from "@shared/apiTypes";

// Phase 4a: track a session's live SessionStatus. Fetches the committed status
// once, then applies status.update events from a SessionSocket so the composer
// (send vs. queue vs. stop) and StatusBar (tokens/cost/context) stay current
// during streaming. Mirrors the legacy sessionController status wiring.

export interface SessionStatusState {
  status: SessionStatus | undefined;
  loading: boolean;
  error: string | undefined;
}

export function useSessionStatus(
  session: SessionRef | undefined,
  machineId = "local",
): SessionStatusState {
  const [status, setStatus] = useState<SessionStatus | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const sessionId = session?.id;
  const cwd = session?.cwd;
  const statusRef = useRef<SessionStatus | undefined>(undefined);
  statusRef.current = status;

  useEffect(() => {
    if (sessionId === undefined || sessionId === "" || cwd === undefined) {
      setStatus(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }

    const ref: SessionRef = { id: sessionId, cwd };
    const socket = new SessionSocket();
    let cancelled = false;

    const applyEvent = (event: SessionUiEvent): void => {
      if (event.type !== "status.update") return;
      setStatus(event.status);
    };

    setLoading(true);
    setError(undefined);

    void sessionsApi
      .status(ref, machineId)
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        socket.connect(ref, applyEvent, undefined, machineId);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [sessionId, cwd, machineId]);

  return { status, loading, error };
}
