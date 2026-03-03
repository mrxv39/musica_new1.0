/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\arrays.ts
 */
import type { SubStrategyItem } from "../types";

/**
 * ✅ Contract export:
 * src/strategy/utils/arrays.ts debe exportar upsertInArray
 */
export function upsertInArray(arr: SubStrategyItem[], item: SubStrategyItem): SubStrategyItem[] {
  const idx = arr.findIndex((x: any) => (x as any)?.id === (item as any)?.id);
  if (idx >= 0) {
    const next = arr.slice();
    next[idx] = item;
    return next;
  }
  return [...arr, item];
}
