import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { effectivePiWebConfig } from "./src/config";

const { config } = effectivePiWebConfig();
const apiPort = config.port ?? 8504;

// Parallel React build. Same output contract as vite.config.ts
// (base "./", outDir dist/client) so the server static seam is unchanged.
// Legacy Lit tree stays default-served until the final cutover.
export default defineConfig({
  plugins: [react()],
  root: "src/client-react",
  base: "./",
  resolve: {
    alias: {
      // Reuse the framework-agnostic shared + api layers untouched.
      "@shared": resolve("src/shared"),
      "@api": resolve("src/client/src/api"),
      // Framework-agnostic reused logic (routing, chat groups, selection, etc.).
      "@client": resolve("src/client/src"),
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@codemirror/legacy-modes")) return "vendor-editor-legacy";
          if (id.includes("@lezer/common") || id.includes("@lezer/highlight") || id.includes("@lezer/lr")) return "vendor-editor-core";
          if (id.includes("@codemirror/lang-") || id.includes("@lezer/")) return "vendor-editor-languages";
          if (id.includes("@codemirror") || id.includes("codemirror")) return "vendor-editor-core";
          if (id.includes("@xterm")) return "vendor-terminal";
          if (id.includes("react-dom")) return "vendor-react-dom";
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 8505,
    strictPort: true,
    ...(config.allowedHosts === undefined ? {} : { allowedHosts: config.allowedHosts }),
    proxy: {
      "/api": { target: `http://localhost:${String(apiPort)}`, ws: true },
      "/pi-web-plugins": { target: `http://localhost:${String(apiPort)}` },
    },
  },
});
