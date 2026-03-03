/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\deepMerge.ts
 */

export function deepMerge(base: any, override: any) {
  const result = { ...base };
  if (!override || typeof override !== "object") return result;

  for (const key in override) {
    if (
      typeof override[key] === "object" &&
      override[key] !== null &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(base?.[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}