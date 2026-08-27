import { type JSX, useEffect, useState } from "react";
import type { FileContentResponse } from "@shared/pluginApiTypes";
import { MAX_INLINE_PREVIEW_BYTES, MAX_INLINE_PREVIEW_LABEL, workspaceFileName } from "@shared/workspaceFiles";
import { workspaceFilePreviewUrl } from "@client/api/urls";
import { formatFileSize } from "@client/utils/format";
import { Markdown } from "../chat/Markdown";
import { CodeViewer } from "./CodeViewer";
import styles from "./WorkspaceFileViewer.module.css";

// Phase 5a: the workspace file viewer, ported from the legacy <workspace-file-viewer>.
// Renders images / HTML / PDF / Markdown previews, code source, and a download
// fallback for binaries, with a Raw/Preview toggle for files that carry both.
// The Raw/Preview preference is per-selection local state (default raw); the
// legacy deep-link/localStorage round-trip is deferred to the polish phase.

export type WorkspaceFilePreviewKind = "image" | "html" | "pdf" | "markdown" | "download" | "code";

export interface WorkspaceFileViewerProps {
  machineId: string;
  projectId: string;
  workspaceId: string;
  selectedPath: string | undefined;
  file: FileContentResponse | undefined;
  loadError: string | undefined;
}

export function WorkspaceFileViewer({
  machineId,
  projectId,
  workspaceId,
  selectedPath,
  file,
  loadError,
}: WorkspaceFileViewerProps): JSX.Element {
  const [mode, setMode] = useState<"preview" | "raw">("raw");
  const [previewFailed, setPreviewFailed] = useState(false);

  // Reset per-selection state whenever the shown file identity changes.
  const fileKey = `${machineId}:${projectId}:${workspaceId}:${selectedPath ?? ""}:${file?.path ?? ""}:${file?.modifiedAt ?? ""}`;
  useEffect(() => {
    setMode("raw");
    setPreviewFailed(false);
  }, [fileKey]);

  if (selectedPath === undefined || selectedPath === "") return status("请选择一个文件。");
  if (loadError !== undefined) return status(`无法加载 ${selectedPath}：${loadError}`, true);
  if (file === undefined) return status(`正在加载 ${selectedPath}…`);
  if (file.path !== selectedPath) {
    return status(`无法预览 ${selectedPath}：加载的内容属于 ${file.path}。`, true);
  }

  const kind = workspaceFilePreviewKind(file);
  const bothModes = hasRawAndPreviewModes(file, kind);
  const canOpen = isBrowserPreviewKind(kind) && file.size > 0 && file.size <= MAX_INLINE_PREVIEW_BYTES;
  const previewUrl = (download = false): string =>
    workspaceFilePreviewUrl(projectId, workspaceId, file.path, { modifiedAt: file.modifiedAt, machineId, download });
  const name = workspaceFileName(file.path);

  const body = (): JSX.Element => {
    if (bothModes && mode === "raw") return rawSource(file);
    if (file.size === 0) return status("此文件为空。");
    switch (kind) {
      case "image":
        return framePreviewGuard(file, () => (
          <div className={styles.imagePreview}>
            <img
              src={previewUrl()}
              alt={`${file.path} 的预览`}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => {
                if (!(mode === "raw" && bothModes)) setPreviewFailed(true);
              }}
            />
          </div>
        ));
      case "html":
        return framePreviewGuard(file, () => (
          <iframe
            className={styles.frame}
            src={previewUrl()}
            sandbox=""
            allow=""
            referrerPolicy="no-referrer"
            title={`${file.path} 的预览`}
          />
        ));
      case "pdf":
        return framePreviewGuard(file, () => (
          <>
            <p className={styles.previewNote} role="status">
              内嵌 PDF 支持因浏览器而异。若文档未显示，请使用上方的“打开 ↗”或“下载”。
            </p>
            <iframe
              className={styles.frame}
              src={previewUrl()}
              allow=""
              referrerPolicy="no-referrer"
              title={`${file.path} 的预览`}
            />
          </>
        ));
      case "markdown":
        return markdownPreview(file);
      case "download":
        return unsupported(file, previewUrl(true), name);
      case "code":
        return rawSource(file);
    }
  };

  function framePreviewGuard(f: FileContentResponse, render: () => JSX.Element): JSX.Element {
    if (f.size > MAX_INLINE_PREVIEW_BYTES) return previewTooLarge(f);
    if (previewFailed) {
      return (
        <div className={styles.previewState} role="alert">
          <strong>{f.path} 预览失败。</strong>
          <span>在新窗口中打开，或使用上方的“下载”。</span>
          <button type="button" className={styles.stateButton} onClick={() => { setPreviewFailed(false); }}>
            重试预览
          </button>
        </div>
      );
    }
    return render();
  }

  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <strong title={file.path}>{file.path}</strong>
        <div className={styles.actions}>
          <small>{metadataForFile(file, kind)}</small>
          {canOpen && (
            <a
              className={styles.action}
              href={previewUrl()}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              title="在新窗口中打开"
            >
              打开 ↗
            </a>
          )}
          <a className={styles.action} href={previewUrl(true)} download={name} title={`下载 ${name}`}>
            下载
          </a>
        </div>
      </div>
      {bothModes && (
        <div className={styles.mode} role="group" aria-label={`查看 ${file.path}`}>
          <button
            type="button"
            aria-pressed={mode === "preview"}
            className={styles.modeButton}
            onClick={() => {
              setMode("preview");
              setPreviewFailed(false);
            }}
          >
            预览
          </button>
          <button
            type="button"
            aria-pressed={mode === "raw"}
            className={styles.modeButton}
            onClick={() => {
              setMode("raw");
              setPreviewFailed(false);
            }}
          >
            源码
          </button>
        </div>
      )}
      {body()}
    </div>
  );

  function rawSource(f: FileContentResponse): JSX.Element {
    if (f.size === 0) return status("此文件为空。");
    return (
      <>
        {f.truncated && (
          <p className={styles.previewNote} role="status">
            源码已截断。请使用“下载”获取完整文件。
          </p>
        )}
        <CodeViewer content={f.content} language={f.language} />
      </>
    );
  }

  function markdownPreview(f: FileContentResponse): JSX.Element {
    if (f.size > MAX_INLINE_PREVIEW_BYTES) return previewTooLarge(f);
    return (
      <>
        {f.truncated && (
          <p className={styles.previewNote} role="status">
            预览基于已截断的源码渲染。请使用“下载”获取完整文件。
          </p>
        )}
        <div className={styles.markdownPreview} dir="auto">
          <Markdown text={f.content} />
        </div>
      </>
    );
  }

  function unsupported(f: FileContentResponse, href: string, fileName: string): JSX.Element {
    return (
      <div className={styles.previewState}>
        <p>此文件类型不支持预览。</p>
        <a className={styles.downloadLink} href={href} download={fileName}>
          下载 {fileName} · {formatFileSize(f.size)}
        </a>
      </div>
    );
  }

  function previewTooLarge(f: FileContentResponse): JSX.Element {
    return status(`文件过大，无法预览：${formatFileSize(f.size)} · 上限 ${MAX_INLINE_PREVIEW_LABEL}。请使用上方的“下载”。`);
  }
}

function status(message: string, alert = false): JSX.Element {
  return alert ? (
    <p className={styles.status} role="alert">
      {message}
    </p>
  ) : (
    <p className={styles.status} role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function workspaceFilePreviewKind(file: FileContentResponse): WorkspaceFilePreviewKind {
  if (file.mediaType === "image") return "image";
  if (file.mediaType === "html") return "html";
  if (file.mediaType === "pdf") return "pdf";
  if (file.mediaType === "markdown") return "markdown";
  if (file.binary) return "download";
  return "code";
}

function hasRawAndPreviewModes(file: FileContentResponse, kind: WorkspaceFilePreviewKind): boolean {
  return kind !== "code" && kind !== "download" && !file.binary;
}

function isBrowserPreviewKind(kind: WorkspaceFilePreviewKind): kind is "image" | "html" | "pdf" {
  return kind === "image" || kind === "html" || kind === "pdf";
}

function metadataForFile(file: FileContentResponse, kind: WorkspaceFilePreviewKind): string {
  const format =
    kind === "code"
      ? file.language ?? "text"
      : kind === "download"
        ? file.mimeType ?? "binary"
        : kind === "markdown"
          ? "markdown"
          : file.mimeType ?? kind;
  return `${format} · ${formatFileSize(file.size)}${file.truncated ? " · 已截断" : ""}`;
}
