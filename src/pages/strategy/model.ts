/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\model.ts
 *
 * Capa UI: NO cambia los tipos del core.
 * Si el core no define name/createdAt/updatedAt, aquí los tratamos como opcionales.
 */
import type { SubStrategyItem } from "../../strategy/types";

export type UiSubStrategyItem = SubStrategyItem & {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function uid() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function asUiSub(x: SubStrategyItem): UiSubStrategyItem {
  return x as UiSubStrategyItem;
}

export function getUiName(x: SubStrategyItem, fallback: string) {
  const u = x as UiSubStrategyItem;
  return (typeof u.name === "string" && u.name.trim()) ? u.name : fallback;
}

export function getUiTimeKey(x: SubStrategyItem): string {
  const u = x as UiSubStrategyItem;
  // si existen, usamos updatedAt > createdAt, sino vacío
  if (typeof u.updatedAt === "string" && u.updatedAt) return u.updatedAt;
  if (typeof u.createdAt === "string" && u.createdAt) return u.createdAt;
  return "";
}
