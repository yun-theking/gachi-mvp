import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Every test run uses a throwaway in-memory database, never data/gachi.db
    // or the deployed Turso DB.
    env: { TURSO_DATABASE_URL: ":memory:" },
  },
});
