import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dev-env/core": path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "packages/core/src/index.ts",
      ),
    },
  },
  test: {
    exclude: ["tests/e2e/**", "**/node_modules/**", "**/dist/**"],
  },
});
