import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database security tests. They run ONLY against a local Supabase stack
// (`npx supabase start`); tests/db/env.ts refuses any non-local URL.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
