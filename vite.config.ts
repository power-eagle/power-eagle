import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    outDir: "./dist",
  },
  resolve: {
    alias: {
      "peagle/state": path.resolve(__dirname, "src/core/runtime/state-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "features/**/*.steps.ts"],
  },
  plugins: [react()],
});
