/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\strategyClipboard.ts
 */
import type { SubStrategyPayload } from "../../strategy/types";

export async function copyPayloadJsonToClipboard(payload: SubStrategyPayload): Promise<void> {
  const text = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(text);
}
