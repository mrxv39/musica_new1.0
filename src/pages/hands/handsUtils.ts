/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsUtils.ts
import { HandsObsRow } from "../../db";

export function safeJson(str?: string) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function extractLocalImagePath(row: HandsObsRow): string | null {
  if ((row as any).frame_ref && String((row as any).frame_ref).trim())
    return String((row as any).frame_ref);

  const obj = safeJson((row as any).ocr_json);

  const direct =
    (obj as any)?.image_ref ??
    (obj as any)?.frame_ref ??
    (obj as any)?.ocr?.image_ref ??
    (obj as any)?.ocr?.frame_ref ??
    null;

  if (direct && String(direct).trim()) return String(direct);
  return null;
}

// 🔥 NUEVO FORMATO: 26/2/26
export function formatDateTime(ms?: number) {
  if (!ms) return "";
  try {
    const d = new Date(ms);
    const day = d.getDate();            // sin cero delante
    const month = d.getMonth() + 1;     // sin cero delante
    const year = d.getFullYear() % 100; // solo 2 dígitos
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

export function formatTempoS(v: number | null): string {
  if (v === null) return "";
  return v.toFixed(3);
}
