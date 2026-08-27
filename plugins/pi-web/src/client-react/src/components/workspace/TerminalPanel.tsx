import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Terminal, type ITerminalOptions, type ITheme } from "@xterm/xterm";
import { FitAddon, type ITerminalDimensions } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalSocket } from "@api/sockets";
import type { TerminalInfo } from "@shared/apiTypes";
import type { TerminalCommandRun } from "@shared/pluginApiTypes";
import { DEFAULT_TERMINAL_ANSI_THEME } from "@client/terminalCopySnapshot";
import {
  commandRunCompletionLabel,
  isCommandRunPending,
  selectFallbackTerminal,
  selectPreferredTerminal,
  useTerminals,
  type TerminalScope,
  type TerminalSize,
} from "../../state/useTerminals";
import styles from "./TerminalPanel.module.css";

// Phase 5b: the native React workspace terminal. Ports the interactive half of
// the legacy <terminal-panel> — tab strip (create/select/close), xterm view
// lifecycle (socket I/O + fit-on-resize + theme sync), command-run notices and
// continue-in-shell. The touch-only copy-mode + soft-keys affordances
// (@media pointer:coarse) are deferred to the polish phase.

const TERMINAL_OPTIONS_BASE: ITerminalOptions = {
  cursorBlink: true,
  convertEol: true,
  fontFamily: "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 13,
};

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 100, rows: 30 };

export interface TerminalPanelProps {
  machineId: string;
  projectId: string;
  workspaceId: string;
  selectedTerminalId: string | undefined;
  onSelectTerminal: (terminalId: string | undefined, options?: { replace?: boolean }) => void;
}

type ServerTerminalMessage =
  | { type: "output"; data: string; replay?: boolean }
  | { type: "exit"; exitCode?: number }
  | { type: "error"; message: string };

export function TerminalPanel({
  machineId,
  projectId,
  workspaceId,
  selectedTerminalId,
  onSelectTerminal,
}: TerminalPanelProps): JSX.Element {
  const scope: TerminalScope = { machineId, projectId, workspaceId };
  const controller = useTerminals(scope);
  const { terminals, commandRuns, loading, error, cancellingRunIds, continuingTerminalIds } = controller;

  // The terminal id the xterm view is currently bound to. Driven by the URL
  // selection resolved against the loaded list; a change tears down + rebinds.
  const [viewTerminalId, setViewTerminalId] = useState<string | undefined>(undefined);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | undefined>(undefined);
  const fitAddonRef = useRef<FitAddon | undefined>(undefined);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const suppressInputRef = useRef(false);
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  // Resolve the preferred terminal whenever the list or requested id changes,
  // mirroring the legacy selectPreferredLoadedTerminal + URL round-trip.
  useEffect(() => {
    if (terminals.length === 0) {
      if (viewTerminalId !== undefined) setViewTerminalId(undefined);
      if (selectedTerminalId !== undefined) onSelectTerminal(undefined, { replace: true });
      return;
    }
    let terminal = selectPreferredTerminal(terminals, { targetTerminalId: selectedTerminalId });
    if (terminal === undefined && selectedTerminalId !== undefined) terminal = selectFallbackTerminal(terminals);
    setViewTerminalId(terminal?.id);
    if (terminal?.id !== selectedTerminalId) onSelectTerminal(terminal?.id, { replace: true });
    // onSelectTerminal is a stable-ish navigate wrapper; guard against loops via id equality above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals, selectedTerminalId]);

  const send = useCallback((message: { type: "input"; data: string } | { type: "resize"; cols: number; rows: number }) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
  }, []);

  const fitTerminal = useCallback((): TerminalSize | undefined => {
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (fitAddon === undefined || terminal === undefined) return undefined;
    const size = terminalSizeFromDimensions(fitAddon.proposeDimensions());
    if (size === undefined) return undefined;
    fitAddon.fit();
    return size;
  }, []);

  const fitAndNotify = useCallback(() => {
    const size = fitTerminal();
    if (size === undefined) return;
    send({ type: "resize", ...size });
  }, [fitTerminal, send]);

  // The xterm view lifecycle: (re)create when the bound terminal id changes.
  useEffect(() => {
    const host = hostRef.current;
    if (viewTerminalId === undefined || host === null) return undefined;

    const terminal = new Terminal({ ...TERMINAL_OPTIONS_BASE, theme: readTerminalTheme(host) });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const resizeObserver = new ResizeObserver(() => {
      fitAndNotify();
    });
    resizeObserver.observe(host);
    resizeObserverRef.current = resizeObserver;

    terminal.onData((data) => {
      if (suppressInputRef.current) return;
      const filtered = filterTerminalInput(data);
      if (filtered !== "") send({ type: "input", data: filtered });
    });

    const initialSize = fitTerminal();
    const socket = terminalSocket(projectId, workspaceId, viewTerminalId, initialSize, machineId);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    const boundId = viewTerminalId;

    socket.addEventListener("open", () => {
      fitAndNotify();
    });
    socket.addEventListener("message", (event) => {
      void handleSocketMessage(event.data, terminal, (exitCode) => {
        controllerRef.current.markExited(boundId, exitCode);
      });
    });
    socket.addEventListener("close", () => {
      if (socketRef.current === socket) socketRef.current = undefined;
    });

    const raf = requestAnimationFrame(() => {
      fitAndNotify();
    });
    terminal.focus();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      resizeObserverRef.current = undefined;
      socket.close();
      if (socketRef.current === socket) socketRef.current = undefined;
      terminal.dispose();
      terminalRef.current = undefined;
      fitAddonRef.current = undefined;
    };
    // Rebind whenever the bound terminal or workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTerminalId, projectId, workspaceId, machineId]);

  // Keep the terminal theme in sync with light/dark toggles.
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const observer = new MutationObserver(() => {
      const terminal = terminalRef.current;
      if (terminal !== undefined) terminal.options.theme = readTerminalTheme(host);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "class", "style"] });
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleSelect = useCallback(
    (terminalId: string) => {
      setViewTerminalId(terminalId);
      onSelectTerminal(terminalId);
    },
    [onSelectTerminal],
  );

  const handleClose = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent, terminalId: string) => {
      event.stopPropagation();
      void (async () => {
        const wasSelected = viewTerminalId === terminalId || selectedTerminalId === terminalId;
        await controller.closeTerminal(terminalId);
        if (wasSelected) {
          const next = controller.terminals.filter((terminal) => terminal.id !== terminalId);
          const nextId = selectFallbackTerminal(next)?.id;
          setViewTerminalId(nextId);
          onSelectTerminal(nextId, { replace: true });
        }
      })();
    },
    [controller, onSelectTerminal, selectedTerminalId, viewTerminalId],
  );

  const handleStart = useCallback(() => {
    void (async () => {
      const size = fitTerminal() ?? DEFAULT_TERMINAL_SIZE;
      const terminal = await controller.startTerminal(size);
      if (terminal !== undefined) {
        setViewTerminalId(terminal.id);
        onSelectTerminal(terminal.id);
      }
    })();
  }, [controller, fitTerminal, onSelectTerminal]);

  const handleContinue = useCallback(
    (terminalId: string) => {
      void (async () => {
        await controller.continueTerminal(terminalId);
        // Rebind the socket for the continued shell.
        setViewTerminalId(undefined);
        setViewTerminalId(terminalId);
      })();
    },
    [controller],
  );

  const selectedTerminal = terminals.find((terminal) => terminal.id === viewTerminalId);
  const selectedCommandRun = resolveSelectedCommandRun(selectedTerminal, commandRuns);

  return (
    <section className={styles.shell}>
      <div className={styles.tabs}>
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            className={clsx(styles.tab, terminal.id === viewTerminalId && styles.tabSelected)}
            onClick={() => {
              handleSelect(terminal.id);
            }}
          >
            <span className={styles.tabLabel}>
              {terminal.name}
              {terminal.exited ? " · 已退出" : ""}
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label={`关闭 ${terminal.name}`}
              className={styles.tabClose}
              onClick={(event) => {
                handleClose(event, terminal.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") handleClose(event, terminal.id);
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button type="button" className={styles.newTab} onClick={handleStart}>
          + Shell
        </button>
      </div>
      {error !== undefined && <p className={styles.error}>{error}</p>}
      {selectedCommandRun !== undefined && (
        <CommandRunNotice
          run={selectedCommandRun}
          terminal={selectedTerminal}
          cancelling={cancellingRunIds.includes(selectedCommandRun.id)}
          continuing={selectedTerminal !== undefined && continuingTerminalIds.includes(selectedTerminal.id)}
          onCancel={() => {
            void controller.cancelCommandRun(selectedCommandRun);
          }}
          onContinue={() => {
            if (selectedTerminal !== undefined) handleContinue(selectedTerminal.id);
          }}
        />
      )}
      {loading && <p className={styles.muted}>正在加载终端…</p>}
      {!loading && terminals.length === 0 && (
        <p className={styles.muted}>暂无终端。启动一个 Shell 以开始。</p>
      )}
      <div className={styles.stage}>
        <div ref={hostRef} className={styles.host} />
      </div>
    </section>
  );
}

interface CommandRunNoticeProps {
  run: TerminalCommandRun;
  terminal: TerminalInfo | undefined;
  cancelling: boolean;
  continuing: boolean;
  onCancel: () => void;
  onContinue: () => void;
}

function CommandRunNotice({ run, terminal, cancelling, continuing, onCancel, onContinue }: CommandRunNoticeProps): JSX.Element | null {
  if (isCommandRunPending(run)) {
    return (
      <section className={clsx(styles.notice, styles.noticeRunning)}>
        <div>
          <strong>{run.title}</strong>
          <p>
            命令正在运行。按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 或使用按钮取消。
          </p>
          <code>{run.command}</code>
        </div>
        <button type="button" className={styles.danger} disabled={cancelling} onClick={onCancel}>
          {cancelling ? "已发送取消…" : "取消命令"}
        </button>
      </section>
    );
  }
  if (terminal?.exited === true) {
    return (
      <section className={clsx(styles.notice, run.status === "succeeded" ? styles.noticeSucceeded : styles.noticeFailed)}>
        <div>
          <strong>{commandRunCompletionLabel(run)}</strong>
          <p>输出已保留。在 Shell 中继续以检查或运行后续命令。</p>
          <code>{run.command}</code>
        </div>
        <button type="button" disabled={continuing} onClick={onContinue}>
          {continuing ? "正在启动 Shell…" : "在 Shell 中继续"}
        </button>
      </section>
    );
  }
  return null;
}

function resolveSelectedCommandRun(
  terminal: TerminalInfo | undefined,
  commandRuns: TerminalCommandRun[],
): TerminalCommandRun | undefined {
  const commandRunId = terminal?.commandRunId;
  if (commandRunId === undefined) return undefined;
  return commandRuns.find((run) => run.id === commandRunId);
}

async function handleSocketMessage(
  data: unknown,
  terminal: Terminal,
  onExit: (exitCode: number | undefined) => void,
): Promise<void> {
  try {
    const message = parseServerMessage(await socketDataToString(data));
    if (message.type === "output") terminal.write(message.data);
    if (message.type === "exit") {
      terminal.writeln(`\r\n[进程已退出${message.exitCode === undefined ? "" : `，退出码 ${String(message.exitCode)}`}]`);
      onExit(message.exitCode);
    }
    if (message.type === "error") terminal.writeln(`\r\n[终端错误：${message.message}]`);
  } catch (error) {
    terminal.writeln(`\r\n[终端错误：${error instanceof Error ? error.message : String(error)}]`);
  }
}

export function filterTerminalInput(data: string): string {
  // Xterm can emit focus-in/focus-out sequences when replayed output leaves
  // focus tracking enabled; bash/readline treats those as typed text.
  return data.replaceAll("\x1b[I", "").replaceAll("\x1b[O", "");
}

function parseServerMessage(data: string): ServerTerminalMessage {
  const value: unknown = JSON.parse(data);
  if (!isRecord(value)) return { type: "error", message: "无效的终端消息" };
  const record = value;
  if (record.type === "output" && typeof record.data === "string")
    return { type: "output", data: record.data, ...(typeof record.replay === "boolean" ? { replay: record.replay } : {}) };
  if (record.type === "exit") return { type: "exit", ...(typeof record.exitCode === "number" ? { exitCode: record.exitCode } : {}) };
  if (record.type === "error" && typeof record.message === "string") return { type: "error", message: record.message };
  return { type: "error", message: "无效的终端消息" };
}

async function socketDataToString(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Blob) return await data.text();
  return String(data);
}

function readTerminalTheme(element: HTMLElement): ITheme {
  return {
    ...DEFAULT_TERMINAL_ANSI_THEME,
    background: themeColor(element, "--surface", "#05070a"),
    foreground: themeColor(element, "--ink", "#e6edf3"),
    cursor: themeColor(element, "--accent", "#58a6ff"),
    selectionBackground: themeColor(element, "--accent-tint", "#264f78"),
  };
}

function themeColor(element: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}

function terminalSizeFromDimensions(dimensions: ITerminalDimensions | undefined): TerminalSize | undefined {
  if (dimensions === undefined || !isValidTerminalSize(dimensions.cols, dimensions.rows)) return undefined;
  return { cols: Math.floor(dimensions.cols), rows: Math.floor(dimensions.rows) };
}

function isValidTerminalSize(cols: number, rows: number): boolean {
  return Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
