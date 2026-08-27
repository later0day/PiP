import { useEffect, useRef, useState } from "react";
import { sessionsApi } from "@api/clients";
import { ChatTranscriptStore } from "@client/chatTranscriptStore";
import { SessionSocket, type SessionUiEvent } from "@client/sessionSocket";
import type { ChatLine } from "@client/components/shared";
import type { SessionRef } from "@shared/apiTypes";

// Phase 3a + 3b: fetch + normalize a session's committed history into a
// ChatTranscriptView (ChatTranscriptStore → normalizeMessages), then layer live
// updates from SessionSocket on top. Join sequence mirrors the legacy
// sessionController: load history + stream snapshot together, seed the in-flight
// partial, record the snapshot watermark, then apply live events with
// seq > watermark (earlier events are already reflected and are dropped).

export interface SessionTranscript {
  messages: ChatLine[];
  loading: boolean;
  error: string | undefined;
}

export function useSessionTranscript(
  session: SessionRef | undefined,
  machineId = "local",
): SessionTranscript {
  const storeRef = useRef<ChatTranscriptStore>();
  storeRef.current ??= new ChatTranscriptStore();
  const store = storeRef.current;

  // Live message list (committed history + seeded partial + applied live events).
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const messagesRef = useRef<ChatLine[]>([]);
  messagesRef.current = messages;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const sessionId = session?.id;
  const cwd = session?.cwd;

  useEffect(() => {
    if (sessionId === undefined || sessionId === "" || cwd === undefined) {
      setMessages([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    const ref: SessionRef = { id: sessionId, cwd };
    const socket = new SessionSocket();
    let cancelled = false;
    // Join-time watermark: events with seq <= this are already reflected in the
    // committed history + seeded partial and must be dropped.
    let watermark = Number.NEGATIVE_INFINITY;

    const setBoth = (next: ChatLine[]): void => {
      messagesRef.current = next;
      setMessages(next);
    };

    const applyEvent = (event: SessionUiEvent): void => {
      if (event.seq !== undefined && event.seq <= watermark) return;
      const next = store.applyLiveEvent(messagesRef.current, event);
      if (next !== undefined) setBoth(next);
    };

    // Seed from cache immediately so a revisited session paints without a flash.
    setBoth(store.cachedView(sessionId).messages);
    setLoading(true);
    setError(undefined);

    void Promise.all([
      sessionsApi.messages(ref, undefined, machineId),
      sessionsApi.streamSnapshot(ref, machineId),
    ])
      .then(([page, snapshot]) => {
        if (cancelled) return;
        const view = store.mergeHistory(sessionId, page);
        const seeded = store.seedStreamingPartial(view.messages, snapshot.partial);
        watermark = snapshot.seq;
        setBoth(seeded);
        // Connect only after the snapshot is applied so the watermark is set.
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
  }, [sessionId, cwd, machineId, store]);

  return { messages, loading, error };
}
