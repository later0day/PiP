import { type JSX, useCallback, useMemo, useState } from "react";
import { useAppState, useSetState } from "../../state/appStore";
import { useController } from "../../state/AppProvider";
import { useRoute } from "../../state/useRoute";
import { useSessionTranscript } from "../../state/useSessionTranscript";
import { useSessionStatus } from "../../state/useSessionStatus";
import { useModelDialogs } from "../../state/useModelDialogs";
import { machineSessionKey } from "@client/machineKeys";
import { ChatView } from "../chat/ChatView";
import { StatusBar } from "../chat/StatusBar";
import { StreamingText } from "../chat/StreamingText";
import { AskUserCard } from "../chat/AskUserCard";
import { ExtensionDialogCard } from "../chat/ExtensionDialogCard";
import { PromptComposer } from "../composer/PromptComposer";
import { ModelPicker } from "../overlays/ModelPicker";
import { CommandPicker } from "../overlays/CommandPicker";
import styles from "./ChatPanel.module.css";
import type {
  AskUserSubmission,
  ExtensionDialogAnswer,
  PromptAttachment,
  PromptAttachmentDelivery,
  SessionRef,
} from "@shared/apiTypes";

// Phase 3a: the chat panel renders the real transcript. Phase 4a adds the send
// path: PromptComposer (bound to sessionsApi.prompt/stop) + StatusBar, driven by
// the live SessionStatus. It resolves the selected session (route.sessionId →
// state.sessions), streams history through useSessionTranscript → ChatView, and
// tracks status through useSessionStatus for send/steer/stop affordances.

export function ChatPanel(): JSX.Element {
  const state = useAppState();
  const controller = useController();
  const { route } = useRoute();

  const session = state.sessions.find((s) => s.id === route.sessionId);
  const hasWorkspace = state.selectedWorkspace !== undefined || route.workspaceId !== undefined;

  const ref = useMemo<SessionRef | undefined>(
    () => (session === undefined ? undefined : { id: session.id, cwd: session.cwd }),
    [session],
  );
  const machineId = state.selectedMachine?.id ?? "local";
  const { messages, loading, error } = useSessionTranscript(ref, machineId);
  const { status } = useSessionStatus(ref, machineId);

  const setState = useSetState();
  const onDialogError = useCallback((message: string) => { setState({ error: message }); }, [setState]);
  const dialogs = useModelDialogs(ref, machineId, status, onDialogError);
  const availableThinkingLevels = useMemo(
    () => dialogs.thinkingDialog?.options.map((option) => option.value) ?? [],
    [dialogs.thinkingDialog],
  );

  const [sending, setSending] = useState(false);

  const canSteer = status?.isStreaming === true;
  const isCompacting = status?.isCompacting === true;
  const canStop =
    status !== undefined &&
    (status.isStreaming || status.isCompacting || status.isBashRunning || status.pendingMessageCount > 0);

  const onSend = useCallback(
    (
      text: string,
      streamingBehavior?: "steer" | "followUp",
      attachments?: PromptAttachment[],
      delivery?: PromptAttachmentDelivery,
    ) => {
      if (ref === undefined) return;
      setSending(true);
      void controller
        .sendPrompt(ref, text, streamingBehavior, machineId, attachments, delivery)
        .finally(() => { setSending(false); });
    },
    [controller, ref, machineId],
  );

  const onStop = useCallback(() => {
    if (ref === undefined) return;
    void controller.stopSession(ref, machineId);
  }, [controller, ref, machineId]);

  const onSubmitAsk = useCallback(
    (askId: string, submission: AskUserSubmission) => {
      if (ref === undefined) return Promise.resolve();
      return controller.submitAsk(ref, askId, submission, machineId);
    },
    [controller, ref, machineId],
  );

  const onAnswerDialog = useCallback(
    (dialogId: string, value: ExtensionDialogAnswer) => {
      if (ref === undefined) return Promise.resolve();
      return controller.answerDialog(ref, dialogId, value, machineId);
    },
    [controller, ref, machineId],
  );

  const onCancelDialog = useCallback(
    (dialogId: string) => {
      if (ref === undefined) return Promise.resolve();
      return controller.cancelDialog(ref, dialogId, machineId);
    },
    [controller, ref, machineId],
  );

  // The ask draft store is keyed by the machine-scoped session id.
  const draftSessionId = session === undefined ? "" : machineSessionKey(machineId, session.id);

  return (
    <div className={styles.inner}>
      {route.sessionId === undefined ? (
        <div className={styles.empty}>
          {hasWorkspace ? (
            <>
              <p className={styles.emptyTitle}>新会话</p>
              <p className={styles.emptyHint}>从侧栏选择一个会话，或新建一个。</p>
              <StreamingText />
            </>
          ) : (
            <p className={styles.emptyHint}>请选择机器、项目和工作区以开始。</p>
          )}
        </div>
      ) : (
        <>
          <div className={styles.transcript}>
            <ChatView messages={messages} loading={loading} error={error} />
          </div>
          <div className={styles.dock}>
            {(status?.pendingAsk !== undefined ||
              (status?.pendingDialogs !== undefined && status.pendingDialogs.length > 0)) && (
              <div className={styles.prompts}>
                {status.pendingAsk !== undefined && (
                  <AskUserCard ask={status.pendingAsk} draftSessionId={draftSessionId} onSubmit={onSubmitAsk} />
                )}
                {status.pendingDialogs?.map((dialog) => (
                  <ExtensionDialogCard
                    key={dialog.dialogId}
                    dialog={dialog}
                    onAnswer={onAnswerDialog}
                    onCancel={onCancelDialog}
                  />
                ))}
              </div>
            )}
            <StatusBar status={status} />
            {session !== undefined && (
              <PromptComposer
                sessionId={session.id}
                machineId={machineId}
                cwd={session.cwd}
                projectId={state.selectedProject?.id ?? route.projectId}
                workspaceId={state.selectedWorkspace?.id ?? route.workspaceId}
                sending={sending}
                canSteer={canSteer}
                isCompacting={isCompacting}
                canStop={canStop}
                model={status?.model}
                thinkingLevel={status?.thinkingLevel}
                availableThinkingLevels={availableThinkingLevels}
                onSelectModel={dialogs.openModelDialog}
                onSelectThinking={dialogs.openThinkingDialog}
                onSend={onSend}
                onStop={onStop}
              />
            )}
          </div>
          {dialogs.modelDialog !== undefined && (
            <ModelPicker
              options={dialogs.modelDialog.options}
              catalog={dialogs.modelDialog.catalog}
              selectedValue={dialogs.modelDialog.selectedValue}
              onPick={dialogs.pickModel}
              onCancel={dialogs.closeModelDialog}
              onToggleEnabled={dialogs.toggleModelEnabled}
              onSetScope={dialogs.setModelScope}
            />
          )}
          {dialogs.thinkingDialog !== undefined && (
            <CommandPicker
              title="选择思考级别"
              options={dialogs.thinkingDialog.options}
              selectedValue={dialogs.thinkingDialog.selectedValue}
              onPick={dialogs.pickThinking}
              onCancel={dialogs.closeThinkingDialog}
            />
          )}
        </>
      )}
    </div>
  );
}
