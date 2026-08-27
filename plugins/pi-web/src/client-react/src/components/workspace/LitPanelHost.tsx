import { type JSX, useEffect, useRef } from "react";
import { render, type TemplateResult } from "lit-html";
import styles from "./LitPanelHost.module.css";

// Phase 5c: the Lit interop bridge. Plugin workspace panels (apiVersion:2) hand
// back a lit-html TemplateResult from their `render(context)`; this host mounts
// it into a plain DOM node via lit-html's own `render()`, re-rendering whenever
// the template changes. The `--pi-*` compat bridge keeps these panels
// theme-coherent with the DSH skin. React never reconciles inside the host —
// lit owns the subtree — so we render into a ref'd div and let lit diff it.

export interface LitPanelHostProps {
  template: TemplateResult;
}

export function LitPanelHost({ template }: LitPanelHostProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    render(template, host);
    return () => {
      // Clear the lit-rendered subtree so directives (timers, observers) detach.
      render(null, host);
    };
  }, [template]);

  return <div ref={hostRef} className={styles.host} />;
}
