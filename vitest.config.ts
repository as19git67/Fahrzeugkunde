import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig hat "jsx": "preserve" (Next übernimmt die Transformation). Für
  // Komponententests (.tsx) muss Vitest JSX selbst umsetzen.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globalSetup: "./src/__tests__/global-setup.ts",
    testTimeout: 15000,
    fileParallelism: false,
    // `next build` (output: standalone) kopiert src/ inkl. der Tests nach
    // .next/standalone/ – ohne diesen Ausschluss liefe jede Testdatei doppelt
    // (und die Kopien scheitern an relativen Pfaden wie ../../startup.js).
    exclude: [...configDefaults.exclude, ".next/**"],
  },
});
