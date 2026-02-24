/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\payload.ts
 *
 * Payload normalization / coercion (never throw to UI)
 */
import type { SubStrategyPayload } from "../../../strategy/types";
import { normalizePayload } from "../../../strategy/utils";
import { defaultPayload } from "../state";

export function coercePayload(p: any): SubStrategyPayload {
  try {
    return normalizePayload((p ?? defaultPayload()) as SubStrategyPayload);
  } catch {
    return defaultPayload();
  }
}
