import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globalSetup: "./src/__tests__/global-setup.ts",
    testTimeout: 15000,
    fileParallelism: false,
  },
});
