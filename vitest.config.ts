import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so the test run doesn't pull in the
// React and browser-polyfill plugins, which the contract tests don't need.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
