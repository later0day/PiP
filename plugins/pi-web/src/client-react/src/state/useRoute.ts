import { useCallback, useEffect, useState } from "react";
import { readRoute, writeRoute, type ParsedAppRoute } from "@client/route";

// Phase 2a: React seam over the reused, framework-agnostic route.ts.
// readRoute/writeRoute own the URL <-> ParsedAppRoute mapping; this hook adds
// the browser wiring React needs: subscribe to popstate + programmatic
// navigation, and re-render on either. Route resolution (plugin panel alias
// resolution via resolveAppRoute) stays a caller concern — this hook returns
// the raw ParsedAppRoute so it works before machine plugins load.

export type RoutePatch = Partial<ParsedAppRoute>;

export interface UseRouteResult {
  route: ParsedAppRoute;
  /** Merge a patch into the current route and push (or replace) history. */
  navigate: (patch: RoutePatch, options?: { replace?: boolean }) => void;
}

/** Custom event writeRoute callers can dispatch to notify same-document listeners. */
const ROUTE_EVENT = "pi-web:route";

export function useRoute(): UseRouteResult {
  const [route, setRoute] = useState<ParsedAppRoute>(() => readRoute());

  useEffect(() => {
    const sync = (): void => {
      setRoute(readRoute());
    };
    // popstate covers back/forward + history.go; the custom event covers our
    // own pushState/replaceState (which don't fire popstate).
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_EVENT, sync);
    // Re-read once on mount in case the URL changed between initial state and
    // effect attach (e.g. an early redirect).
    sync();
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);

  const navigate = useCallback((patch: RoutePatch, options?: { replace?: boolean }): void => {
    const current = readRoute();
    const next: ParsedAppRoute = { ...current, ...patch };
    writeRoute(next, options?.replace === true ? { replace: true } : undefined);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }, []);

  return { route, navigate };
}
