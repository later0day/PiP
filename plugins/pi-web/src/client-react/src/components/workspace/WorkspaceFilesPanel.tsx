import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { FileTreeEntry } from "@shared/pluginApiTypes";
import { workspaceUploadPath } from "@client/api/workspaceUploads";
import { formatFileSize } from "@client/utils/format";
import type { WorkspaceUploadBatchState, WorkspaceUploadFileState } from "@client/workspaceUploadState";
import { WorkspaceFileViewer } from "./WorkspaceFileViewer";
import type { FileExplorerController } from "../../state/useFileExplorer";
import { cssVars } from "../../lib/cssVars";
import styles from "./WorkspaceFilesPanel.module.css";

// Phase 5a: the workspace Files panel, ported from the legacy <workspace-files-panel>.
// A tree + file viewer split, drag-and-drop direct upload, an upload-review
// dialog, and per-batch upload progress. Bound to a useFileExplorer controller
// rather than the plugin WorkspacePanelContext.

export interface WorkspaceFilesPanelProps {
  machineId: string;
  projectId: string;
  workspaceId: string;
  uploadDefaultFolder: string;
  explorer: FileExplorerController;
}

interface PendingUpload {
  files: File[];
}

export function WorkspaceFilesPanel({
  machineId,
  projectId,
  workspaceId,
  uploadDefaultFolder,
  explorer,
}: WorkspaceFilesPanelProps): JSX.Element {
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | undefined>(undefined);
  const [destinationFolder, setDestinationFolder] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [createDirs, setCreateDirs] = useState(true);
  const [formError, setFormError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scopeKey = `${machineId}:${projectId}:${workspaceId}`;
  const closeDialog = useCallback(() => {
    setPendingUpload(undefined);
    setFormError("");
  }, []);

  // Reset the pending upload + drag state when the workspace scope changes.
  useEffect(() => {
    closeDialog();
    dragDepth.current = 0;
    setDragActive(false);
  }, [scopeKey, closeDialog]);

  const openUploadReview = useCallback(
    (files: File[]) => {
      setPendingUpload({ files });
      setDestinationFolder(uploadDefaultFolder);
      setOverwrite(false);
      setCreateDirs(true);
      setFormError("");
    },
    [uploadDefaultFolder],
  );

  const startDirect = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      explorer.startUpload(files, {
        destinationFolder: uploadDefaultFolder,
        createDirs: true,
        overwrite: false,
        selectUploadedFile: true,
      });
    },
    [explorer, uploadDefaultFolder],
  );

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = fileListToArray(event.currentTarget.files);
    event.currentTarget.value = "";
    if (files.length > 0) openUploadReview(files);
  };

  const onDragEnter = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const onDragOver = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const onDrop = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const files = fileListToArray(event.dataTransfer.files);
    if (files.length > 0) startDirect(files);
  };

  const submitReview = (event: React.FormEvent): void => {
    event.preventDefault();
    if (pendingUpload === undefined) return;
    const validationError = workspaceUploadReviewError(pendingUpload.files, destinationFolder);
    if (validationError !== undefined) {
      setFormError(validationError);
      return;
    }
    explorer.startUpload(pendingUpload.files, {
      destinationFolder,
      createDirs,
      overwrite,
      selectUploadedFile: true,
    });
    closeDialog();
  };

  return (
    <section
      className={clsx(styles.filesPanel, dragActive && styles.dragging)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <section className={styles.toolbar}>
        <strong>文件</strong>
        {explorer.fileTreeStale && <span className={styles.stale}>已过时</span>}
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.button} onClick={() => fileInputRef.current?.click()}>
            上传
          </button>
          <button type="button" className={styles.button} onClick={explorer.refreshFiles}>
            刷新
          </button>
        </div>
        <input ref={fileInputRef} className={styles.visuallyHidden} type="file" multiple onChange={onFileInputChange} />
      </section>

      {explorer.error !== undefined && (
        <p className={styles.panelError} role="alert">
          {explorer.error}
        </p>
      )}

      {explorer.uploadBatches.length > 0 && (
        <section className={styles.uploadProgress} aria-label="工作区上传">
          <div className={styles.uploadProgressHeader}>
            <strong>上传</strong>
            <small>{uploadSummaryLabel(explorer.uploadBatches)}</small>
          </div>
          {explorer.uploadBatches.map((batch) => (
            <UploadBatch key={batch.id} batch={batch} onCancel={explorer.cancelUpload} onClear={explorer.clearUpload} />
          ))}
        </section>
      )}

      <section className={styles.split}>
        <div className={styles.tree}>
          {explorer.fileTree.length === 0 ? (
            <p className={styles.muted}>未加载任何文件。</p>
          ) : (
            explorer.fileTree.map((entry) => (
              <TreeEntry key={entry.path} entry={entry} depth={0} explorer={explorer} />
            ))
          )}
        </div>
        <div className={styles.viewer}>
          <WorkspaceFileViewer
            machineId={machineId}
            projectId={projectId}
            workspaceId={workspaceId}
            selectedPath={explorer.selectedFilePath}
            file={explorer.selectedFileContent}
            loadError={explorer.selectedFileLoadError}
          />
        </div>
      </section>

      <div className={styles.dropOverlay} aria-hidden={!dragActive}>
        <div>
          <strong>拖放文件以上传</strong>
          <span>立即上传到默认文件夹。</span>
        </div>
      </div>

      {pendingUpload !== undefined && (
        <div className={styles.dialogBackdrop} onMouseDown={closeDialog}>
          <section
            className={styles.uploadDialog}
            role="dialog"
            aria-modal="true"
            aria-label="检查文件上传"
            tabIndex={-1}
            onMouseDown={(event) => { event.stopPropagation(); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeDialog();
              }
            }}
          >
            <header>
              <div>
                <span className={styles.eyebrow}>上传</span>
                <h2>检查{pendingUpload.files.length === 1 ? "文件" : `${String(pendingUpload.files.length)} 个文件`}</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="取消上传" onClick={closeDialog}>
                ×
              </button>
            </header>
            <form onSubmit={submitReview}>
              <label>
                <span>目标文件夹</span>
                <input
                  value={destinationFolder}
                  placeholder={uploadDefaultFolder}
                  onChange={(event) => {
                    setDestinationFolder(event.target.value);
                    setFormError("");
                  }}
                />
                <small>相对于工作区。留空则上传到工作区根目录。</small>
              </label>
              <div className={styles.dialogOptions}>
                <label>
                  <input type="checkbox" checked={createDirs} onChange={(event) => { setCreateDirs(event.target.checked); }} />
                  <span>创建父文件夹</span>
                </label>
                <label>
                  <input type="checkbox" checked={overwrite} onChange={(event) => { setOverwrite(event.target.checked); }} />
                  <span>覆盖已有文件</span>
                </label>
              </div>
              <section className={styles.reviewFiles} aria-label="待上传文件">
                <strong>{pendingUpload.files.length === 1 ? "文件" : "文件"}</strong>
                {pendingUpload.files.map((file, index) => (
                  <div key={`${file.name}:${String(index)}`} className={styles.reviewFile}>
                    <span>{file.name}</span>
                    <small>{formatFileSize(file.size)}</small>
                  </div>
                ))}
              </section>
              {formError !== "" && (
                <div className={styles.dialogError} role="alert">
                  {formError}
                </div>
              )}
              <footer>
                <button type="button" className={styles.button} onClick={closeDialog}>
                  取消
                </button>
                <button type="submit" className={styles.primaryButton}>
                  上传
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function TreeEntry({
  entry,
  depth,
  explorer,
}: {
  entry: FileTreeEntry;
  depth: number;
  explorer: FileExplorerController;
}): JSX.Element {
  const children = explorer.expandedDirs[entry.path];
  const hasChildren = children !== undefined;
  const selected = entry.type !== "directory" && explorer.selectedFilePath === entry.path;
  return (
    <>
      <button
        type="button"
        className={clsx(styles.row, selected && styles.rowSelected)}
        style={cssVars({ "--depth": String(depth) })}
        onClick={() => { if (entry.type === "directory") explorer.expandDir(entry.path); else explorer.selectFile(entry.path); }}
      >
        <span>{entry.type === "directory" ? (hasChildren ? "▾" : "▸") : "·"}</span>
        <span>{entry.name}</span>
      </button>
      {hasChildren && children.map((child) => <TreeEntry key={child.path} entry={child} depth={depth + 1} explorer={explorer} />)}
    </>
  );
}

function UploadBatch({
  batch,
  onCancel,
  onClear,
}: {
  batch: WorkspaceUploadBatchState;
  onCancel: (batchId: string) => void;
  onClear: (batchId: string) => void;
}): JSX.Element {
  return (
    <article className={clsx(styles.uploadBatch, styles[`batch_${batch.status}`])}>
      <div className={styles.uploadBatchHeading}>
        <div>
          <strong>{uploadBatchTitle(batch)}</strong>
          <small>{batch.destinationFolder === "" ? "工作区根目录" : batch.destinationFolder}</small>
        </div>
        <span>{uploadBatchStatusLabel(batch)}</span>
      </div>
      <progress max={1} value={uploadBatchProgressValue(batch)} />
      <div className={styles.uploadFileList}>
        {batch.files.map((file) => (
          <div key={`${file.path}:${String(file.index)}`} className={clsx(styles.uploadFile, styles[`file_${file.status}`])}>
            <div className={styles.uploadFileMain}>
              <span>{file.name}</span>
              <small>{uploadFileDetail(file)}</small>
            </div>
            <span className={styles.uploadFileStatus}>{uploadFileStatusLabel(file)}</span>
          </div>
        ))}
      </div>
      <div className={styles.uploadActions}>
        {batch.status === "uploading" ? (
          <button type="button" className={styles.button} onClick={() => { onCancel(batch.id); }}>
            取消
          </button>
        ) : (
          <button type="button" className={styles.button} onClick={() => { onClear(batch.id); }}>
            关闭
          </button>
        )}
      </div>
    </article>
  );
}

// --- pure helpers (ported from the legacy panel module) ---

export function workspaceUploadReviewError(files: readonly File[], destinationFolder: string): string | undefined {
  if (files.length === 0) return "请至少选择一个要上传的文件。";
  for (const file of files) {
    try {
      workspaceUploadPath(destinationFolder, file.name);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
  return undefined;
}

function fileListToArray(files: FileList | null | undefined): File[] {
  return files === null || files === undefined ? [] : Array.from(files);
}

function isFileDrag(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function uploadSummaryLabel(batches: readonly WorkspaceUploadBatchState[]): string {
  const uploading = batches.filter((batch) => batch.status === "uploading").length;
  return uploading === 0 ? `${String(batches.length)} 个最近` : `${String(uploading)} 个上传中`;
}

function uploadBatchTitle(batch: WorkspaceUploadBatchState): string {
  const count = String(batch.files.length);
  switch (batch.status) {
    case "completed": return `已上传 ${count} 个文件`;
    case "error": return `${count} 个文件上传失败`;
    case "cancelled": return `已取消 ${count} 个文件的上传`;
    case "uploading": return `正在上传 ${count} 个文件`;
  }
}

function uploadBatchStatusLabel(batch: WorkspaceUploadBatchState): string {
  switch (batch.status) {
    case "completed": return "完成";
    case "error": return "失败";
    case "cancelled": return "已取消";
    case "uploading": return formatPercent(batch.percent);
  }
}

function uploadBatchProgressValue(batch: WorkspaceUploadBatchState): number {
  return batch.status === "uploading" ? batch.percent : 1;
}

function uploadFileStatusLabel(file: WorkspaceUploadFileState): string {
  switch (file.status) {
    case "pending": return "等待中";
    case "uploading": return formatPercent(file.percent);
    case "completed": return "完成";
    case "error": return "错误";
    case "cancelled": return "已取消";
  }
}

function uploadFileDetail(file: WorkspaceUploadFileState): string {
  if (file.error !== undefined) return file.error;
  if (file.response !== undefined) return `已写入 ${file.response.path}`;
  return `${file.path} · ${formatFileSize(file.loaded)} / ${formatFileSize(file.total)}`;
}

function formatPercent(value: number): string {
  return `${String(Math.round(Math.max(0, Math.min(1, value)) * 100))}%`;
}
