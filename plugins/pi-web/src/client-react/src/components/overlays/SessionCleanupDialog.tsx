import { type JSX, useEffect, useState } from "react";
import clsx from "clsx";
import { ModalSurface } from "../../primitives";
import type {
  SessionCleanupExecuteResponse,
  SessionCleanupPreviewResponse,
  SessionCleanupProjectSummary,
  SessionCleanupRequest,
} from "@shared/apiTypes";
import {
  canRunSessionCleanup,
  confirmSessionCleanup,
  DEFAULT_SESSION_CLEANUP_DRAFT,
  selectedSessionCleanupProjectCwds,
  sessionCleanupPreviewForSelectedProjects,
  sessionCleanupPreviewHasTargets,
  sessionCleanupRequestKey,
  validateSessionCleanupDraft,
  type SessionCleanupDraft,
} from "@client/sessionCleanupUi";
import styles from "./SessionCleanupDialog.module.css";

// SessionCleanupDialog — React port of the Lit session-cleanup-dialog. Preview
// then run manual cleanup for the selected machine: two day-threshold toggles
// (archive-idle / delete-archived), a per-project selection table over the
// preview, and a permanent-delete confirmation before running. All
// validation/selection/confirmation logic is reused verbatim from the pure
// sessionCleanupUi module; the parent (useSessionCleanup) owns the network calls
// + result state. This is the pi-web surface for beautifului's SelectionActions
// (#20) — a multiselect action bar over real session data. DSH-skinned on the
// shared ModalSurface.

export interface SessionCleanupDialogProps {
  preview: SessionCleanupPreviewResponse | undefined;
  previewRequest: SessionCleanupRequest | undefined;
  result: SessionCleanupExecuteResponse | undefined;
  loading: boolean;
  running: boolean;
  error: string;
  onPreview: (request: SessionCleanupRequest) => void | Promise<void>;
  onRun: (request: SessionCleanupRequest) => void | Promise<void>;
  onClose: () => void;
}

export function SessionCleanupDialog(props: SessionCleanupDialogProps): JSX.Element {
  const { preview, previewRequest, result, loading, running } = props;
  const [draft, setDraft] = useState<SessionCleanupDraft>({ ...DEFAULT_SESSION_CLEANUP_DRAFT });
  const [formError, setFormError] = useState("");
  // undefined means "all preview projects selected"; a list narrows the run.
  const [selectedProjectCwds, setSelectedProjectCwds] = useState<string[] | undefined>(undefined);

  // Reset the selection to all projects whenever a fresh preview arrives, like
  // the legacy willUpdate(preview) hook.
  useEffect(() => {
    setSelectedProjectCwds(preview?.projects.map((project) => project.cwd));
  }, [preview]);

  const disabled = loading || running;
  const validation = validateSessionCleanupDraft(draft);

  const selectedCwds = preview === undefined ? [] : selectedSessionCleanupProjectCwds(preview, selectedProjectCwds);
  const selectedPreview = preview === undefined ? undefined : sessionCleanupPreviewForSelectedProjects(preview, selectedCwds);
  const runEnabled = canRunSessionCleanup({ draft, preview: selectedPreview, previewRequest, loading, running });
  const runTitle = runEnabled
    ? "运行清理"
    : selectedPreview !== undefined && !sessionCleanupPreviewHasTargets(selectedPreview)
      ? "请至少选择一个项目再运行清理"
      : "运行前请先预览清理";

  const updateDraft = (patch: Partial<SessionCleanupDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setFormError("");
  };

  const setProjectSelected = (cwd: string, selected: boolean): void => {
    if (preview === undefined) return;
    const next = new Set(selectedCwds);
    if (selected) next.add(cwd);
    else next.delete(cwd);
    setSelectedProjectCwds(preview.projects.map((project) => project.cwd).filter((projectCwd) => next.has(projectCwd)));
    setFormError("");
  };

  const previewCleanup = (): void => {
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }
    setFormError("");
    void props.onPreview(validation.request);
  };

  const runCleanup = (): void => {
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }
    if (!canRunSessionCleanup({ draft, preview: selectedPreview, previewRequest })) {
      setFormError(
        selectedPreview !== undefined && !sessionCleanupPreviewHasTargets(selectedPreview)
          ? "请至少选择一个项目再运行清理。"
          : "运行前请先预览清理。",
      );
      return;
    }
    if (selectedPreview === undefined || !confirmSessionCleanup(selectedPreview, (message) => window.confirm(message))) return;
    setFormError("");
    void props.onRun({ ...validation.request, projectCwds: selectedCwds });
  };

  const validationError = validation.ok ? "" : validation.error;
  const previewOutOfDate =
    preview !== undefined &&
    validation.ok &&
    sessionCleanupRequestKey(validation.request) !== sessionCleanupRequestKey(previewRequest) &&
    sessionCleanupPreviewHasTargets(preview);
  const message = formError || props.error;

  return (
    <ModalSurface onClose={props.onClose} busy={running} label="清理会话" className={styles.surface}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>会话</span>
            <h1>清理会话</h1>
          </div>
          <button type="button" className={styles.close} title="关闭清理" aria-label="关闭清理" onClick={props.onClose}>
            ×
          </button>
        </header>
        <div className={styles.body}>
          <p className={styles.intro}>
            在归档空闲会话或永久删除旧的已归档会话之前，先预览此机器上的手动清理。
          </p>

          <fieldset className={styles.fieldset} disabled={disabled}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={draft.archiveIdleEnabled}
                onChange={(event) => { updateDraft({ archiveIdleEnabled: event.target.checked }); }}
              />
              <span>归档空闲超过以下天数的非归档会话</span>
              <input
                className={styles.days}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.archiveIdleDays}
                disabled={disabled || !draft.archiveIdleEnabled}
                onChange={(event) => { updateDraft({ archiveIdleDays: event.target.value }); }}
              />
              <span>天</span>
            </label>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={draft.deleteArchivedEnabled}
                onChange={(event) => { updateDraft({ deleteArchivedEnabled: event.target.checked }); }}
              />
              <span>删除已归档超过以下天数的会话</span>
              <input
                className={styles.days}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.deleteArchivedDays}
                disabled={disabled || !draft.deleteArchivedEnabled}
                onChange={(event) => { updateDraft({ deleteArchivedDays: event.target.value }); }}
              />
              <span>天</span>
            </label>
          </fieldset>
          <p className={styles.warning}>
            <strong>删除不可恢复。</strong> 清理只会删除已归档的会话。
          </p>
          {validationError !== "" && (
            <div className={styles.dialogError} role="alert">
              {validationError}
            </div>
          )}
          {previewOutOfDate && (
            <div className={styles.hint} role="status">
              阈值已更改。请重新预览后再运行清理。
            </div>
          )}

          {message !== "" && (
            <div className={styles.dialogError} role="alert">
              {message}
            </div>
          )}

          {preview !== undefined && renderPreview(preview, selectedCwds, disabled, running, setProjectSelected, () => {
            setSelectedProjectCwds(preview.projects.map((project) => project.cwd));
            setFormError("");
          }, () => {
            setSelectedProjectCwds([]);
            setFormError("");
          })}

          {result !== undefined && renderResult(result)}
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.button} onClick={props.onClose}>
            {result === undefined ? "取消" : "关闭"}
          </button>
          <button type="button" className={styles.button} disabled={loading || running} onClick={previewCleanup}>
            {loading ? "预览中…" : "预览"}
          </button>
          <button type="button" className={clsx(styles.button, styles.danger)} disabled={!runEnabled} title={runTitle} onClick={runCleanup}>
            {running ? "运行中…" : "运行清理"}
          </button>
        </footer>
      </div>
    </ModalSurface>
  );
}

function renderPreview(
  preview: SessionCleanupPreviewResponse,
  selectedCwds: string[],
  disabled: boolean,
  running: boolean,
  setProjectSelected: (cwd: string, selected: boolean) => void,
  selectAll: () => void,
  deselectAll: () => void,
): JSX.Element {
  const selected = new Set(selectedCwds);
  const selectedPreview = sessionCleanupPreviewForSelectedProjects(preview, selectedCwds);
  const skipped = preview.skippedBusySessionIds ?? [];
  return (
    <section className={styles.preview} aria-label="清理预览">
      <h2>预览</h2>
      {preview.projects.length === 0 ? (
        <p className={styles.empty}>没有会话符合这些阈值。</p>
      ) : (
        <>
          <div className={styles.selectionControls} role="group" aria-label="项目选择">
            <span>
              已选择 {selectedCwds.length} / {preview.projects.length} 个项目
            </span>
            <button
              type="button"
              className={styles.button}
              disabled={disabled || selectedCwds.length === preview.projects.length}
              onClick={selectAll}
            >
              全选
            </button>
            <button type="button" className={styles.button} disabled={disabled || selectedCwds.length === 0} onClick={deselectAll}>
              取消全选
            </button>
          </div>
          {selectedCwds.length === 0 && (
            <p className={styles.hint} role="status">
              请至少选择一个项目再运行清理。
            </p>
          )}
          <div className={styles.tableScroll} tabIndex={0} aria-label="清理项目表">
            <table>
              <thead>
                <tr>
                  <th>清理</th>
                  <th>项目/工作区路径</th>
                  <th>归档</th>
                  <th>删除归档</th>
                </tr>
              </thead>
              <tbody>
                {preview.projects.map((project) => renderProjectRow(project, selected.has(project.cwd), running, setProjectSelected))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2}>所选合计</th>
                  <td>{selectedPreview.totals.archiveCount}</td>
                  <td>{selectedPreview.totals.deleteCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      {skipped.length > 0 && (
        <p className={styles.hint}>
          已跳过 {skipped.length} 个忙碌会话。
        </p>
      )}
    </section>
  );
}

function renderProjectRow(
  project: SessionCleanupProjectSummary,
  selected: boolean,
  running: boolean,
  setProjectSelected: (cwd: string, selected: boolean) => void,
): JSX.Element {
  return (
    <tr key={project.cwd} className={selected ? undefined : styles.unselected}>
      <td className={styles.selectCell}>
        <input
          type="checkbox"
          aria-label={`清理 ${project.cwd}`}
          checked={selected}
          disabled={running}
          onChange={(event) => { setProjectSelected(project.cwd, event.target.checked); }}
        />
      </td>
      <th title={project.cwd} dir="auto">
        {project.cwd}
      </th>
      <td>{project.archiveCount}</td>
      <td>{project.deleteCount}</td>
    </tr>
  );
}

function renderResult(result: SessionCleanupExecuteResponse): JSX.Element {
  return (
    <section className={styles.result} aria-label="清理结果">
      <h2>清理完成</h2>
      <p>
        已归档 {result.archivedSessionIds.length} 个会话；已永久删除{" "}
        {result.deletedSessionIds.length} 个已归档会话。
      </p>
    </section>
  );
}
