export const ESTRATEGIAS_GLOBALES = ["BASE"] as const;
export type StrategyGlobal = (typeof ESTRATEGIAS_GLOBALES)[number];
