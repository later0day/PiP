import { useCallback, useEffect, useRef, useState } from "react";
import {
  capturePromptAttachments,
  effectivePromptAttachmentDelivery,
} from "@client/promptAttachmentCapture";
import {
  clearStagedAttachments,
  loadStagedAttachments,
  saveStagedAttachments,
  type PendingAttachment,
} from "@client/promptAttachmentStaging";
import { loadAttachmentDelivery, saveAttachmentDelivery } from "@client/attachmentPreferences";
import type { PromptAttachment, PromptAttachmentDelivery } from "@shared/apiTypes";

// Phase 4b: manage the composer's staged attachments. Ports the legacy
// PromptEditor attachment state (staging store keyed by machine:session, capture
// via readFileAsBase64, delivery preference, chip removal) into a hook. The
// send path itself lives in the controller (AppProvider.sendPrompt) which
// orchestrates folder-delivery upload + reference rewrite.

export interface AttachmentsController {
  attachments: readonly PendingAttachment[];
  error: string | undefined;
  delivery: PromptAttachmentDelivery;
  effectiveDelivery: PromptAttachmentDelivery;
  addFiles: (files: readonly File[]) => Promise<void>;
  remove: (id: string) => void;
  changeDelivery: (mode: PromptAttachmentDelivery) => void;
  toPromptAttachments: () => PromptAttachment[];
  clear: () => void;
}

function pendingToPromptAttachment(attachment: PendingAttachment): PromptAttachment {
  if (attachment.kind === "image") {
    return { kind: "image", mimeType: attachment.mimeType, data: attachment.data, name: attachment.name };
  }
  return { kind: "file", mimeType: attachment.mimeType, data: attachment.data, name: attachment.name };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader result"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function useAttachments(key: string | undefined): AttachmentsController {
  const [attachments, setAttachments] = useState<readonly PendingAttachment[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [delivery, setDelivery] = useState<PromptAttachmentDelivery>(() => loadAttachmentDelivery());
  const seqRef = useRef(0);
  // Track the previous key so a session switch persists the outgoing session's
  // staged attachments before loading the new one's (mirrors the legacy
  // saveStagedAttachments-on-willUpdate).
  const keyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previous = keyRef.current;
    if (previous !== undefined) saveStagedAttachments(previous, attachments);
    keyRef.current = key;
    setAttachments(key !== undefined ? loadStagedAttachments(key) : []);
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: readonly PendingAttachment[]) => {
      setAttachments(next);
      if (key !== undefined) saveStagedAttachments(key, next);
    },
    [key],
  );

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      setError(undefined);
      const { attachments: captured, error: captureError } = await capturePromptAttachments(files, readFileAsBase64);
      if (captured.length > 0) {
        const tagged = captured.map((attachment) => ({ id: `attachment-${String(++seqRef.current)}`, ...attachment }));
        persist([...attachments, ...tagged]);
      }
      if (captureError !== undefined) setError(captureError);
    },
    [attachments, persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist(attachments.filter((attachment) => attachment.id !== id));
    },
    [attachments, persist],
  );

  const changeDelivery = useCallback((mode: PromptAttachmentDelivery) => {
    setDelivery(mode);
    saveAttachmentDelivery(mode);
  }, []);

  const toPromptAttachments = useCallback(
    () => attachments.map((attachment) => pendingToPromptAttachment(attachment)),
    [attachments],
  );

  const clear = useCallback(() => {
    setAttachments([]);
    setError(undefined);
    if (key !== undefined) clearStagedAttachments(key);
  }, [key]);

  return {
    attachments,
    error,
    delivery,
    effectiveDelivery: effectivePromptAttachmentDelivery(delivery, attachments),
    addFiles,
    remove,
    changeDelivery,
    toPromptAttachments,
    clear,
  };
}
