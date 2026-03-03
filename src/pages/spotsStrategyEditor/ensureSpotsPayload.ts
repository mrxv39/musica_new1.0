/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\ensureSpotsPayload.ts
 */

import { DEFAULT_OR_BLOCK, REQUIRED_OR_BLOCK_KEYS } from "./payload";

export function ensureSpotsPayload(input: any) {
  const p = input && typeof input === "object" ? { ...input } : {};
  const ob = p.or_blocks && typeof p.or_blocks === "object" ? { ...p.or_blocks } : {};

  for (const k of REQUIRED_OR_BLOCK_KEYS) {
    const cur = ob[k];
    if (!cur || typeof cur !== "object") {
      ob[k] = { ...DEFAULT_OR_BLOCK };
    } else {
      // defensivo por si faltan campos
      if (typeof cur.min !== "number") ob[k].min = 0;
      if (typeof cur.max !== "number") ob[k].max = 0;
      if (typeof cur.range !== "string") ob[k].range = "";
    }
  }

  return { ...p, or_blocks: ob };
}