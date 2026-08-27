import { useEffect, useState } from "react";
import { PluginRegistry } from "@client/plugins/registry";
import { loadExternalPlugins } from "@client/plugins/external";
import type { QualifiedWorkspacePanelContribution } from "@client/plugins/types";

// Phase 5c: the plugin registry as a React hook. Builds one PluginRegistry,
// loads the gateway plugin manifest once (the framework-agnostic
// loadExternalPlugins + registry logic is reused verbatim), and exposes the
// registered workspace panels so the WorkspacePanel host can render their tabs
// via the Lit interop bridge. Remote/machine-specific plugin loading (a second
// manifest per remote machine) is deferred to a later increment.

export interface PluginsController {
  registry: PluginRegistry;
  workspacePanels: QualifiedWorkspacePanelContribution[];
  loaded: boolean;
}

export function usePlugins(): PluginsController {
  const [registry] = useState(() => new PluginRegistry());
  const [workspacePanels, setWorkspacePanels] = useState<QualifiedWorkspacePanelContribution[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const live = { cancelled: false };
    void (async () => {
      try {
        const result = await loadExternalPlugins("pi-web-plugins/manifest.json");
        if (live.cancelled) return;
        for (const registration of result.registrations) {
          try {
            registry.register(registration);
          } catch (error) {
            console.warn(`Failed to register PI WEB plugin ${registration.id}`, error);
          }
        }
        for (const failure of result.failures) {
          console.warn(`Failed to load PI WEB plugin ${failure.entry.id}`, failure.error);
        }
      } catch (error) {
        console.warn("Failed to load PI WEB plugins", error);
      } finally {
        if (!live.cancelled) {
          setWorkspacePanels(registry.getWorkspacePanels());
          setLoaded(true);
        }
      }
    })();
    return () => {
      live.cancelled = true;
    };
  }, [registry]);

  return { registry, workspacePanels, loaded };
}
