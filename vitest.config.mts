import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic in src/lib (date/recurrence math, the ICS
// parser, sort helpers, session token signing). Route handlers are tested in
// src/app/api/__tests__ by calling them directly against a fake `sql`
// (src/test/apiHarness.ts); nothing here talks to a real Postgres.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Placeholders so modules that read env at import time (lib/db asserts
    // DATABASE_URL is set) load without a real backend. Tests either
    // never query or mock `@/lib/db`, so the connection string is never dialled.
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
