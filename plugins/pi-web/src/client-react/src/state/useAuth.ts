import { useEffect, useMemo, useRef } from "react";
import { AuthController } from "@client/controllers/authController";
import type { AppState } from "@client/appState";
import type { AuthType, SessionStatus } from "@shared/apiTypes";
import { useAppState, useSetState } from "./appStore";

// useAuth — instantiate the reused legacy AuthController in the React tree. The
// controller owns the whole login/logout state machine (method → providers →
// oauth polling → logout) and writes `authDialog` into AppState via setState,
// exactly as it did under Lit; this hook only supplies the (getState, setState,
// applyStatus) seam and re-exposes the imperative methods the dialog + palette
// actions call. The mounted dialog reads AppState.authDialog for what to show.

export interface UseAuthResult {
  authDialog: AppState["authDialog"];
  openLogin: (providerId?: string) => void;
  openLogout: (providerId?: string) => void;
  chooseMethod: (authType: AuthType) => void;
  selectProvider: (providerId: string, authType?: AuthType) => void;
  logoutProvider: (providerId: string) => void;
  updateOAuthInput: (value: string) => void;
  respondOAuth: (value?: string) => void;
  cancelOAuth: () => void;
  closeDialog: () => void;
}

export function useAuth(): UseAuthResult {
  const state = useAppState();
  const setState = useSetState();

  // Keep a live state ref so the controller's getState reads fresh values
  // without recreating the controller (which owns polling timers).
  const stateRef = useRef(state);
  stateRef.current = state;

  const controller = useMemo(() => {
    // getState/setState mirror the legacy closure contract; applyStatus merges
    // the refreshed session status the same way the React status wiring does.
    const getState = (): AppState => stateRef.current;
    const applyStatus = (status: SessionStatus): void => {
      const current = stateRef.current.selectedSession;
      if (current === undefined) return;
      setState({ sessionStatuses: { ...stateRef.current.sessionStatuses, [current.id]: status } });
    };
    return new AuthController(getState, setState, applyStatus);
     
  }, [setState]);

  useEffect(() => () => { controller.dispose(); }, [controller]);

  return {
    authDialog: state.authDialog,
    openLogin: (providerId) => void controller.openLogin(providerId),
    openLogout: (providerId) => void controller.openLogout(providerId),
    chooseMethod: (authType) => void controller.chooseLoginMethod(authType),
    selectProvider: (providerId, authType) => void controller.selectLoginProvider(providerId, authType),
    logoutProvider: (providerId) => void controller.logoutProvider(providerId),
    updateOAuthInput: (value) => { controller.updateOAuthInput(value); },
    respondOAuth: (value) => void controller.respondOAuth(value),
    cancelOAuth: () => void controller.cancelOAuth(),
    closeDialog: () => { controller.closeDialog(); },
  };
}
