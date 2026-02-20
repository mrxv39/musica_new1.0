/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.helpers.ts
 *
 * Helpers puros para useStrategyPage.
 * (Mínimo, pero útil; añade aquí lo que useStrategyPage necesite)
 */

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  // suficiente para UI (no cripto)
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function safeJsonStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "{}";
  }
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
