/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\array.ts
 *
 * Helpers: array ops
 */
import type { SubStrategyItem } from "../../../strategy/types";

export function upsertInArray(arr: SubStrategyItem[], item: SubStrategyItem): SubStrategyItem[] {
  const idx = arr.findIndex((x: any) => (x as any)?.id === (item as any)?.id);
  if (idx >= 0) {
    const next = arr.slice();
    next[idx] = item;
    return next;
  }
  return [...arr, item];
}
