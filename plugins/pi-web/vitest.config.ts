import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Server + framework-agnostic logic tests run in the default node
        // environment, exactly as before.
        extends: true,
        test: {
          name: "node",
          include: [
            "src/**/*.test.ts",
            "pi-web-plugins/**/*.test.ts",
            "pi-packages/**/*.test.ts",
            "scripts/**/*.test.mjs",
          ],
          exclude: ["src/client-react/**", "**/node_modules/**"],
        },
      },
      {
        // React component tests run in happy-dom with RTL + jest-dom.
        extends: true,
        plugins: [react()],
        resolve: {
          alias: {
            "@shared": resolve("src/shared"),
            "@api": resolve("src/client/src/api"),
            "@client": resolve("src/client/src"),
          },
        },
        test: {
          name: "client-react",
          environment: "happy-dom",
          include: ["src/client-react/**/*.test.{ts,tsx}"],
          setupFiles: ["src/client-react/test/setup.ts"],
        },
      },
    ],
  },
});
