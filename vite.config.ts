import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function trimGeneratedWhitespace(): Plugin {
  return {
    name: "trim-generated-whitespace",
    generateBundle(_options, bundle) {
      Object.values(bundle).forEach(output => {
        if (output.type === "chunk") output.code = output.code.replace(/[ \t]+$/gm, "");
      });
    },
  };
}

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
  plugins: [react(), trimGeneratedWhitespace()],
});
