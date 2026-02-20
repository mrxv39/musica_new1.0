import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
