/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\nashPushFold.ts
 *
 * Nash push/fold chart helpers.
 *
 * Soporta valores del chart como:
 * - number: 15            => { min: 0, max: 15 }
 * - string: "15"          => { min: 0, max: 15 }
 * - string: "11-5"        => { min: 5, max: 11 }
 * - object: {min,max}     => { min, max }
 */

export type NashRange = { min: number; max: number };

// chart["76s"] puede ser "11-5", 15, {min:5,max:11}, etc.
export type NashChart = Record<string, any>;

export function normalizeNashRange(v: any): NashRange | null {
  if (v == null) return null;

  // number => 0..n
  if (typeof v === "number" && Number.isFinite(v)) {
    const max = Math.max(0, v);
    return { min: 0, max };
  }

  // string => "15" o "11-5"
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // "15"
    if (/^\d+(\.\d+)?$/.test(s)) {
      const max = Number(s);
      if (!Number.isFinite(max)) return null;
      return { min: 0, max: Math.max(0, max) };
    }

    // "11-5" (permitimos orden invertido)
    const m = s.match(/^(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[3]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return { min: Math.max(0, min), max: Math.max(0, max) };
    }

    return null;
  }

  // object {min,max} o {max} o {min,max,range}
  if (typeof v === "object") {
    const minRaw = (v as any).min;
    const maxRaw = (v as any).max;

    // si solo hay max => 0..max
    if (maxRaw != null && minRaw == null) {
      const max = Number(maxRaw);
      if (!Number.isFinite(max)) return null;
      return { min: 0, max: Math.max(0, max) };
    }

    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

    return { min: Math.max(0, Math.min(min, max)), max: Math.max(0, Math.max(min, max)) };
  }

  return null;
}

export function getNashRange(chart: NashChart | undefined, handKey: string | undefined): NashRange | null {
  if (!chart || typeof chart !== "object") return null;
  const hk = String(handKey ?? "").trim();
  if (!hk) return null;

  const raw = (chart as any)[hk];
  return normalizeNashRange(raw);
}

/**
 * Intenta sacar la mano del payload sin asumir nombre exacto.
 * Ajusta aquí si tu campo real es otro (pero esto NO rompe si no existe).
 */
export function inferHandKey(payload: any): string | undefined {
  return (
    payload?.handKey ??
    payload?.hero_hand ??
    payload?.heroHand ??
    payload?.hand ??
    payload?.cards ??
    undefined
  );
}