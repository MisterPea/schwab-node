import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.smoke.live.test.ts"],
    passWithNoTests: true,
  },
});
