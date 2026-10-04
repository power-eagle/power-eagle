import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    outDir: "./dist",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "features/**/*.steps.ts"],
    exclude: ["src/host/install/provider-probe.test.ts"],
  },
  plugins: [react()],
});
