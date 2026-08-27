import { type JSX, useEffect, useRef } from "react";
import clsx from "clsx";
import { groupChatMessages, summarizeChatGroup, type ChatGroup } from "@client/chatGroups";
import type { ChatLine, ChatPart } from "@client/components/shared";
import { Markdown } from "./Markdown";
import { ToolExecutionCard } from "./ToolExecutionCard";
import styles from "./ChatView.module.css";

// Phase 3a: the real chat transcript. Normalized ChatLine[] (from
// useSessionTranscript) → groupChatMessages() → per-part rendering. Technical
// event runs collapse into a <details> group (summarizeChatGroup); readable
// messages render as role-colored cards. Live updates arrive in Phase 3b.

export interface ChatViewProps {
  messages: ChatLine[];
  loading: boolean;
  error: string | undefined;
}

const ROLE_LABEL: Record<ChatLine["role"], string> = {
  user: "你",
  assistant: "助手",
  tool: "工具",
  system: "系统",
  bash: "Shell",
  skill: "技能",
};

export function ChatView({ messages, loading, error }: ChatViewProps): JSX.Element {
  const groups = groupChatMessages(messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className={styles.chat}>
      {error !== undefined && <div className={styles.error}>{error}</div>}
      {groups.map((group) => (
        <ChatGroupView key={groupKey(group)} group={group} />
      ))}
      {loading && messages.length === 0 && <div className={styles.loading}>正在加载会话记录…</div>}
      <div ref={bottomRef} className={styles.scrollMarker} aria-hidden="true" />
    </div>
  );
}

function groupKey(group: ChatGroup): string {
  return group.kind === "group" ? `g${String(group.startIndex)}-${String(group.endIndex)}` : `m${String(group.index)}`;
}

function ChatGroupView({ group }: { group: ChatGroup }): JSX.Element {
  if (group.kind === "group") {
    return (
      <details className={clsx(styles.msg, styles.eventGroup)}>
        <summary className={styles.groupSummary}>{summarizeChatGroup(group.messages)}</summary>
        <div className={styles.groupBody}>
          {group.messages.map((message, index) => (
            <MessageLine key={index} message={message} inGroup />
          ))}
        </div>
      </details>
    );
  }
  return <MessageLine message={group.message} />;
}

function MessageLine({ message, inGroup = false }: { message: ChatLine; inGroup?: boolean }): JSX.Element {
  const parts = message.parts.map((part, index) => (
    <PartView key={index} part={part} role={message.role} />
  ));

  // Mockup reading column: a user turn is a right-aligned bubble (r22,
  // --dsw-specific-bubble, no role label); an assistant turn is a borderless
  // markdown block. Both only apply to top-level (non-grouped) messages.
  if (!inGroup && message.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={styles.bubble}>{parts}</div>
      </div>
    );
  }
  if (!inGroup && message.role === "assistant") {
    return <div className={styles.assistant}>{parts}</div>;
  }

  // Tool/system/bash/skill (and everything inside a collapsed event group) keep
  // the labeled card treatment.
  return (
    <div className={clsx(inGroup ? styles.groupMsg : styles.msg, styles[message.role])}>
      {!inGroup && <div className={styles.msgHeader}>{ROLE_LABEL[message.role]}</div>}
      {parts}
    </div>
  );
}

function PartView({ part, role }: { part: ChatPart; role: ChatLine["role"] }): JSX.Element | null {
  switch (part.type) {
    case "text":
      return role === "bash" ? (
        <pre className={styles.shellOutput}>{part.text}</pre>
      ) : (
        <Markdown text={part.text} />
      );
    case "thinking":
      return (
        <details className={styles.thinking}>
          <summary>思考</summary>
          <Markdown text={part.text} />
        </details>
      );
    case "toolExecution":
      return <ToolExecutionCard execution={part} />;
    case "toolCall":
      return (
        <div className={styles.toolLine}>
          <strong>{part.toolName}</strong>
          {part.summary !== "" && <span className={styles.summary}>{part.summary}</span>}
        </div>
      );
    case "toolResult":
      return <pre className={styles.shellOutput}>{part.text}</pre>;
    case "image":
      return (
        <img
          className={styles.chatImage}
          src={`data:${part.mimeType};base64,${part.data}`}
          alt="附件图片"
        />
      );
    case "skillInvocation":
      return (
        <details className={styles.skill}>
          <summary>技能：{part.name}</summary>
          <small>{part.location}</small>
          <Markdown text={part.content} />
        </details>
      );
    case "skillRead":
      return (
        <div className={styles.skill}>
          <strong>读取技能：{part.name}</strong>
          <small>{part.path}</small>
        </div>
      );
    case "askUserRecord":
      return <div className={styles.askRecord}>已回答提问</div>;
    case "empty":
      return null;
    default:
      return null;
  }
}
