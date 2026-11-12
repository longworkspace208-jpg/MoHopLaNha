import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./lib/mock-server-only.ts")
    }
  }
});

