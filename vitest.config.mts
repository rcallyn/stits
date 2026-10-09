import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic in src/lib (date/recurrence math, the ICS
// parser, sort helpers, session token signing). They deliberately don't touch
// Postgres or Next request handling — those need an integration harness.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Placeholders so modules that read env at import time (lib/db asserts
    // DATABASE_URL is set) load without a real backend. No unit test issues
    // a query, so the connection string is never dialled.
    env: {
      DATABASE_URL: "postgres://user:pass@localhost:5432/stits_test",
      SESSION_SECRET: "test-secret-value",
      APP_PASSWORD: "test-password",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
