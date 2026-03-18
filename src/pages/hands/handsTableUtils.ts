/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsTableUtils.ts

export function safeParseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function uniqStable(xs: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function isUsableHandClass(hc: string): boolean {
  const s = hc.trim();
  return s.length > 0 && s !== "??";
}

/** Display string for Spots "Mano" column from spots.raw_json (mano_result). */
export function getManoFromRawJson(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "";
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return "";
  }
  const mr = root.mano_result;
  if (!mr || typeof mr !== "object") return "";
  const o = mr as Record<string, unknown>;
  const handClass =
    o.hand_class != null ? String(o.hand_class).trim() : "";
  if (isUsableHandClass(handClass)) return handClass;
  const manoRaw = o.mano_raw;
  if (manoRaw != null && String(manoRaw).trim()) return String(manoRaw).trim();
  const mano = o.mano;
  if (mano != null && String(mano).trim()) return String(mano).trim();
  return "";
}