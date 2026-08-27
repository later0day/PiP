import { useCallback, useRef, useState } from "react";
import { sessionsApi, filesApi } from "@api/clients";
import {
  detectPromptCompletionTrigger,
  fileCompletionInsertText,
  modelCompletionChoices,
} from "@client/promptCompletions";
import type { CompletionItem } from "./completionTypes";
import type { SessionRef } from "@shared/apiTypes";

// Phase 4b: prompt completions for the composer. Detects the active trigger
// (/command, @file, #model) at the cursor via the reused
// detectPromptCompletionTrigger, fetches the matching options, and returns
// CompletionItem[] the composer inserts. A request version guards against
// out-of-order responses (mirrors the legacy PromptEditor.refreshCompletions).

const LIMIT = 12;

export interface CompletionsController {
  items: CompletionItem[];
  selectedIndex: number;
  refresh: (draft: string, cursor: number) => void;
  clear: () => void;
  move: (delta: number) => void;
  setSelectedIndex: (index: number) => void;
}

export interface CompletionsContext {
  ref: SessionRef | undefined;
  machineId: string;
  projectId: string | undefined;
  workspaceId: string | undefined;
}

export function useCompletions(context: CompletionsContext): CompletionsController {
  const [items, setItemsState] = useState<CompletionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const versionRef = useRef(0);
  // Keep the current items in a ref so move() can wrap the selection against the
  // latest length without depending on render-time state.
  const itemsRef = useRef<CompletionItem[]>([]);
  const setItems = useCallback((next: CompletionItem[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const clear = useCallback(() => {
    versionRef.current += 1;
    setItems([]);
    setSelectedIndex(0);
  }, [setItems]);

  const refresh = useCallback(
    (draft: string, cursor: number) => {
      const trigger = detectPromptCompletionTrigger(draft, cursor);
      const version = ++versionRef.current;
      setSelectedIndex(0);
      if (trigger === undefined) {
        setItems([]);
        return;
      }
      const { ref, machineId, projectId, workspaceId } = context;
      if (trigger.kind === "command" && ref !== undefined) {
        void sessionsApi
          .commands(ref, machineId)
          .then((commands) => {
            if (version !== versionRef.current) return;
            setItems(
              commands
                .filter((command) => command.name.toLowerCase().includes(trigger.query.toLowerCase()))
                .slice(0, LIMIT)
                .map((command) => ({
                  kind: "command",
                  replaceFrom: trigger.from,
                  replaceTo: trigger.to,
                  insertText: `/${command.name}`,
                  detail: command.source,
                  ...(command.description === undefined ? {} : { description: command.description }),
                })),
            );
          })
          .catch(() => {
            if (version === versionRef.current) setItems([]);
          });
      } else if (trigger.kind === "file" && projectId !== undefined && workspaceId !== undefined) {
        void filesApi
          .files(trigger.query, { scope: trigger.fileScope, machineId, projectId, workspaceId })
          .then((files) => {
            if (version !== versionRef.current) return;
            setItems(
              files.slice(0, LIMIT).map((file) => {
                const insertText = fileCompletionInsertText(
                  file.path,
                  trigger.quoted === true,
                  file.path.endsWith("/") ? trigger.allPrefix : undefined,
                );
                return {
                  kind: "file",
                  replaceFrom: trigger.from,
                  replaceTo: trigger.to,
                  insertText,
                  detail: file.kind,
                  ...(file.path.endsWith("/") && insertText.endsWith('"')
                    ? { cursorOffset: insertText.length - 1 }
                    : {}),
                };
              }),
            );
          })
          .catch(() => {
            if (version === versionRef.current) setItems([]);
          });
      } else if (trigger.kind === "model" && ref !== undefined) {
        void sessionsApi
          .models(ref, machineId)
          .then((response) => {
            if (version !== versionRef.current) return;
            setItems(
              modelCompletionChoices(response.models, trigger.query).map((choice) => ({
                kind: "model",
                replaceFrom: trigger.from,
                replaceTo: trigger.to,
                ...choice,
              })),
            );
          })
          .catch(() => {
            if (version === versionRef.current) setItems([]);
          });
      } else {
        setItems([]);
      }
    },
    [context],
  );

  const move = useCallback((delta: number) => {
    const length = itemsRef.current.length;
    if (length === 0) return;
    setSelectedIndex((index) => (index + delta + length) % length);
  }, []);

  return { items, selectedIndex, refresh, clear, move, setSelectedIndex };
}
