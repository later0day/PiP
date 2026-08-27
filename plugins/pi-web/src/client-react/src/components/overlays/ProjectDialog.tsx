import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import type { FileSuggestion } from "@shared/apiTypes";
import { projectsApi, trustApi } from "@api/clients";
import { ModalSurface } from "../../primitives";
import styles from "./ProjectDialog.module.css";

// ProjectDialog — the add-project surface (legacy ProjectDialog.ts). A path field
// with server-suggested folder rows (arrow/Tab to pick), a create-if-missing
// toggle, and a server-resolved trust choice keyed on the entered path. Two
// staleness counters keep the trust read from invalidating in-flight suggestion
// requests. DSH-skinned on ModalSurface.

/** Trust choice submitted with the path; `changed` is false for the pre-filled value. */
export interface ProjectTrustChoice {
  trusted: boolean;
  changed: boolean;
}

interface ProjectTrustState {
  path: string;
  decision: boolean | null;
  trusted: boolean;
  loading: boolean;
  error?: string;
}

export interface ProjectDialogProps {
  machineId?: string;
  onSubmit: (path: string, create: boolean, trust: ProjectTrustChoice | undefined) => void;
  onCancel: () => void;
}

export function ProjectDialog({ machineId = "local", onSubmit, onCancel }: ProjectDialogProps): JSX.Element {
  const [path, setPath] = useState("");
  const [createMissing, setCreateMissing] = useState(true);
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trust, setTrust] = useState<ProjectTrustState | undefined>(undefined);
  const [trustTouched, setTrustTouched] = useState(false);

  // Separate staleness counters: applyPath fires both loaders, so a shared one
  // would make the trust read invalidate every in-flight suggestions request.
  const suggestionRequestId = useRef(0);
  const trustRequestId = useRef(0);
  const trustTouchedRef = useRef(false);
  trustTouchedRef.current = trustTouched;

  const loadSuggestions = useCallback(
    async (query: string): Promise<void> => {
      const requestId = ++suggestionRequestId.current;
      setLoading(true);
      try {
        const results = await projectsApi.projectDirectories(query, machineId);
        if (requestId !== suggestionRequestId.current) return;
        setSuggestions(results);
        setSelected((current) => Math.min(current, Math.max(0, results.length - 1)));
      } catch {
        if (requestId === suggestionRequestId.current) setSuggestions([]);
      } finally {
        if (requestId === suggestionRequestId.current) setLoading(false);
      }
    },
    [machineId],
  );

  const loadTrust = useCallback(
    async (query: string): Promise<void> => {
      const requestId = ++trustRequestId.current;
      const trimmed = query.trim();
      if (trimmed === "") {
        if (requestId === trustRequestId.current) setTrust(undefined);
        return;
      }
      // Keep the previous value visible (cosmetic continuity) while the read for
      // the new path is in flight; the result replaces it either way.
      setTrust((previous) => ({
        ...(previous ?? { path: trimmed, decision: null, trusted: false }),
        path: trimmed,
        loading: true,
      }));
      try {
        const result = await trustApi.projectTrust(trimmed, machineId);
        if (requestId !== trustRequestId.current || trustTouchedRef.current) return;
        setTrust({ path: result.path, decision: result.decision, trusted: result.trusted, loading: false });
      } catch (error) {
        if (requestId !== trustRequestId.current || trustTouchedRef.current) return;
        setTrust({
          path: trimmed,
          decision: null,
          trusted: false,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [machineId],
  );

  // Load the initial suggestion list once on mount.
  useEffect(() => {
    void loadSuggestions("");
  }, [loadSuggestions]);

  const applyPath = useCallback(
    (value: string): void => {
      setPath(value);
      setSelected(0);
      setTrustTouched(false);
      trustTouchedRef.current = false;
      void loadSuggestions(value);
      void loadTrust(value);
    },
    [loadSuggestions, loadTrust],
  );

  const submit = useCallback((): void => {
    if (path.trim() === "") return;
    onSubmit(path, createMissing, trust === undefined ? undefined : { trusted: trust.trusted, changed: trustTouched });
  }, [path, createMissing, trust, trustTouched, onSubmit]);

  const onTrustChange = useCallback((checked: boolean): void => {
    setTrustTouched(true);
    trustTouchedRef.current = true;
    setTrust((previous) => (previous === undefined ? previous : { ...previous, trusted: checked, loading: false }));
  }, []);

  // Escape + backdrop are owned by ModalSurface (routed to onCancel). The
  // remaining keys stay scoped to the path input so footer buttons keep native
  // behavior.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((current) => Math.min(current + 1, Math.max(0, suggestions.length - 1)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => Math.max(0, current - 1));
      } else if (event.key === "Tab") {
        const suggestion = suggestions[selected];
        if (suggestion === undefined) return;
        event.preventDefault();
        applyPath(suggestion.path);
      }
    },
    [submit, suggestions, selected, applyPath],
  );

  const trustUnavailable = trust === undefined || trust.loading || trust.error !== undefined;

  return (
    <ModalSurface onClose={onCancel} initialFocus="input" label="添加项目" className={styles.surface}>
      <header className={styles.header}>
        <strong>添加项目</strong>
        <button type="button" className={styles.close} onClick={onCancel} aria-label="关闭">
          ×
        </button>
      </header>
      <div className={styles.body}>
        <label className={styles.field}>
          项目文件夹
          <input
            className={styles.input}
            value={path}
            onChange={(event) => { applyPath(event.target.value); }}
            onKeyDown={onKeyDown}
            placeholder="/path/to/project 或 ~/code/project"
          />
        </label>
        <div className={styles.suggestions}>
          {loading ? <div className={styles.hint}>正在加载文件夹…</div> : null}
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.path}
              type="button"
              className={index === selected ? styles.suggestionSelected : styles.suggestion}
              onClick={() => { applyPath(suggestion.path); }}
            >
              {suggestion.path}
            </button>
          ))}
          {!loading && suggestions.length === 0 ? (
            <div className={styles.hint}>没有匹配的文件夹。输入新路径以创建。</div>
          ) : null}
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={createMissing}
            onChange={(event) => { setCreateMissing(event.target.checked); }}
          />
          若文件夹不存在则创建
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={trust?.trusted ?? false}
            disabled={trustUnavailable}
            onChange={(event) => { onTrustChange(event.target.checked); }}
          />
          <span>信任此项目</span>
        </label>
        <small className={styles.trustHint}>
          信任后 pi 可加载该项目的 .pi 设置、扩展、技能和包。{" "}
          <a href="https://pi.dev/docs/latest/security" target="_blank" rel="noreferrer">
            了解项目信任
          </a>
        </small>
        {trust?.error !== undefined ? (
          <small className={styles.trustError}>信任状态不可用：{trust.error}</small>
        ) : null}
      </div>
      <footer className={styles.footer}>
        <button type="button" className={styles.button} onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={path.trim() === ""}
          onClick={submit}
        >
          添加项目
        </button>
      </footer>
    </ModalSurface>
  );
}
