/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\constants.ts
 *
 * Compat: tests/hook usan "GLOBAL" además de "BASE"
 */
export const ESTRATEGIAS_GLOBALES = ["BASE", "GLOBAL"] as const;
export type StrategyGlobal = (typeof ESTRATEGIAS_GLOBALES)[number];
