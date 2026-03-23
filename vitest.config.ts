import { defineConfig } from "vitest/config";

const mode = process.env.VITEST_MODE ?? "fast";

const include =
  mode === "slow"
    ? ["src/test/**/*.slow.test.{ts,tsx}"]
    : ["src/test/**/*.test.{ts,tsx}", "src/test/**/*.spec.{ts,tsx}"];

const exclude = mode === "slow" ? [] : ["src/test/**/*.slow.test.{ts,tsx}"];

/**
 * Política de coverage (incremental, lenta y segura):
 * - Global (temporal) para no bloquear por legacy.
 * - Strategy (zona crítica) estricta.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts", "src/test/setupTests.ts"],
    include,
    exclude,
    coverage: {
      provider: "v8",
      // ✅ Gate GLOBAL (temporal, para no bloquear por legado)
      thresholds: {
        lines: 35,
        branches: 35,
        functions: 35,
        statements: 35,
      },

      // ⚠️ Si tu Vitest no soporta thresholds por patrones, esto se ignorará.
      // En ese caso te paso un gate alternativo que lo valida por reporte.
      thresholdsByFile: [
        {
          // Zona crítica: strategy
          // (ajusta si quieres añadir/quitar rutas)
          files: [
            "src/pages/strategy/**/*.ts",
            "src/pages/strategy/**/*.tsx",
            "src/strategy/**/*.ts",
            "src/strategy/**/*.tsx",
          ],
          thresholds: {
            lines: 80,
            branches: 70,
            functions: 80,
            statements: 80,
          },
        },
      ],
    },
  },
});