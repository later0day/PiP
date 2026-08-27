import { createContext, useContext } from "react";
import type { Dispatch } from "react";
import type { AppState } from "@client/appState";

// Phase 2b: split State/Dispatch contexts so components that only dispatch
// don't re-render when unrelated slices of state change. The reducer merges a
// shallow patch, mirroring the legacy setState(patch) contract exactly, so the
// ported controllers keep their (getState, setState, apis) shape unchanged.

export type AppStatePatch = Partial<AppState>;

/** The single action the store accepts: a shallow merge patch (legacy setState). */
export type AppAction =
  | { type: "patch"; patch: AppStatePatch }
  | { type: "replace"; state: AppState };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "replace":
      return action.state;
    default:
      return state;
  }
}

export const AppStateContext = createContext<AppState | null>(null);
export const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (state === null) throw new Error("useAppState must be used within <AppProvider>");
  return state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(AppDispatchContext);
  if (dispatch === null) throw new Error("useAppDispatch must be used within <AppProvider>");
  return dispatch;
}

/** Convenience: a setState(patch) callback matching the legacy controller contract. */
export function useSetState(): (patch: AppStatePatch) => void {
  const dispatch = useAppDispatch();
  return (patch: AppStatePatch): void => {
    dispatch({ type: "patch", patch });
  };
}
