/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsPageUtils.ts

import { SPOTS_OUT_BASE, yyyymmdd } from "./handsPagePaths";

export const ensureNonEmptyPath = (p: string | undefined | null, fallback: string): string => {
  const v = String(p || "").trim();
  return v.length > 0 ? v : fallback;
};

export const getErrorMessage = (e: unknown): string => {
  if (typeof e === "string") return e;

  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }

  try {
    return String(e);
  } catch {
    return "unknown error";
  }
};

export const buildWorkersOutDir = (d: Date = new Date()): string => {
  const today = yyyymmdd(d);
  return `${SPOTS_OUT_BASE}\\${today}`;
};

export const isWorkersRunningFromStatus = (statusText: string): boolean => {
  const s = String(statusText || "").toLowerCase();
  return s.includes("workers running");
};
