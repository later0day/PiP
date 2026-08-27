/**
 * Runtime theme boot + toggle. Mirrors the pre-paint <script> in index.html
 * (DSH model: light = default body, dark = body[data-ds-dark-theme]) and reuses
 * the same storage key the legacy client writes, so preferences carry over.
 */
export const THEME_STORAGE_KEY = "pi-web-app-theme";

export type ThemeMode = "dsh-light" | "dsh-dark";

interface StoredPreference {
  themeId?: string;
  auto?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPreference(): StoredPreference | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const themeId = typeof parsed.themeId === "string" ? parsed.themeId : undefined;
    const auto = typeof parsed.auto === "boolean" ? parsed.auto : undefined;
    return { themeId, auto };
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve the effective mode from stored preference + OS setting. */
export function resolveMode(): ThemeMode {
  const pref = readPreference();
  const auto = pref?.auto !== false;
  if (auto) return prefersDark() ? "dsh-dark" : "dsh-light";
  const id = typeof pref.themeId === "string" ? pref.themeId : "";
  return /light/i.test(id) ? "dsh-light" : "dsh-dark";
}

/** Apply a mode to <body> + color-scheme. */
export function applyMode(mode: ThemeMode): void {
  const dark = mode === "dsh-dark";
  if (dark) document.body.setAttribute("data-ds-dark-theme", "");
  else document.body.removeAttribute("data-ds-dark-theme");
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Persist a chosen mode (auto=false) and apply it. */
export function setMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ themeId: `themes:pi-web-${mode === "dsh-dark" ? "dark" : "light"}`, auto: false }),
    );
  } catch {
    /* ignore persistence failures (private mode) */
  }
  applyMode(mode);
}

/** Reconcile <body> with the resolved preference on startup. */
export function bootTheme(): ThemeMode {
  const mode = resolveMode();
  applyMode(mode);
  return mode;
}

/** The three theme choices the picker offers. */
export type ThemeChoice = "auto" | "dsh-light" | "dsh-dark";

/** The currently persisted choice (auto when no explicit preference is pinned). */
export function currentChoice(): ThemeChoice {
  const pref = readPreference();
  if (pref?.auto !== false) return "auto";
  const id = typeof pref.themeId === "string" ? pref.themeId : "";
  return /light/i.test(id) ? "dsh-light" : "dsh-dark";
}

/** Follow the OS setting: clear the pinned preference + apply the resolved mode. */
export function setAuto(): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ auto: true }));
  } catch {
    /* ignore persistence failures (private mode) */
  }
  applyMode(prefersDark() ? "dsh-dark" : "dsh-light");
}

/** Apply a picker choice (auto follows the OS; the others pin a mode). */
export function applyChoice(choice: ThemeChoice): void {
  if (choice === "auto") setAuto();
  else setMode(choice);
}
