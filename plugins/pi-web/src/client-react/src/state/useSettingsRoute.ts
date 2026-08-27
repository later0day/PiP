import { useCallback, useEffect, useState } from "react";
import { readSettingsSection, writeSettingsSection, type SettingsSection } from "@client/settingsRoute";

// useSettingsRoute — React seam over the reused settingsRoute.ts. The settings
// dialog's open state + active section live entirely in the URL (?settings=…),
// so a deep link opens the dialog on the right section and back/forward closes
// it. Mirrors useRoute's popstate + custom-event wiring.

const ROUTE_EVENT = "pi-web:route";

export interface UseSettingsRouteResult {
  /** Active settings section, or undefined when the dialog is closed. */
  section: SettingsSection | undefined;
  open: (section: SettingsSection, options?: { replace?: boolean }) => void;
  navigate: (section: SettingsSection, options?: { replace?: boolean }) => void;
  close: () => void;
}

export function useSettingsRoute(): UseSettingsRouteResult {
  const [section, setSection] = useState<SettingsSection | undefined>(() => readSettingsSection());

  useEffect(() => {
    const sync = (): void => {
      setSection(readSettingsSection());
    };
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);

  const open = useCallback((next: SettingsSection, options?: { replace?: boolean }): void => {
    writeSettingsSection(next, options);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }, []);

  const close = useCallback((): void => {
    writeSettingsSection(undefined);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }, []);

  return { section, open, navigate: open, close };
}
