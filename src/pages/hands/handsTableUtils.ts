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

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function seatForRole(posiciones: Record<string, unknown>, role: string): "p1" | "p2" | "p3" | null {
  const want = String(role || "").toUpperCase().trim();
  if (!want) return null;
  for (const seat of ["p1", "p2", "p3"] as const) {
    const v = String((posiciones as any)[seat] ?? "").toUpperCase().trim();
    if (v === want) return seat;
  }
  return null;
}

export type EffectiveStackResult = {
  se_bb: number | null;
  hero_total: number | null;
  opp_max_total: number | null;
  excluded_btn_seat: "p2" | "p3" | null;
  reason: string;
};

/** Frontend port of modules/strategy/effective_stack.py::compute_effective_stack_bb (BB in, BB out). */
export function computeEffectiveStackBbFromSpot(args: {
  stacks_json?: string | null;
  bets_json?: string | null;
  raw_json?: string | null;
}): EffectiveStackResult {
  const stacks = safeParseJson<Record<string, unknown>>(args.stacks_json ?? null) ?? {};
  const bets = safeParseJson<Record<string, unknown>>(args.bets_json ?? null) ?? {};
  const raw = safeParseJson<any>(args.raw_json ?? null) ?? null;

  const posiciones =
    (raw?.preflop?.ocr?.posiciones as Record<string, unknown> | undefined) ??
    (raw?.preflop?.posiciones as Record<string, unknown> | undefined) ??
    (raw?.preflop?.ocr?.pos as Record<string, unknown> | undefined) ??
    null;

  const total = (seat: "p1" | "p2" | "p3"): number | null => {
    const behind = toNum((stacks as any)[seat]);
    const committed = toNum((bets as any)[seat]);
    if (behind == null && committed == null) return null;
    return (behind ?? 0) + (committed ?? 0);
  };

  const hero_total = total("p1");
  if (hero_total == null) {
    return { se_bb: null, hero_total: null, opp_max_total: null, excluded_btn_seat: null, reason: "missing_p1" };
  }

  // Default: include both opponents.
  let excluded_btn_seat: "p2" | "p3" | null = null;
  const oppSeats: Array<"p2" | "p3"> = ["p2", "p3"];

  // Worker uses posiciones to infer BTN fold. If missing, we still compute SE without exclusion.
  if (posiciones && typeof posiciones === "object") {
    const hero_role = String((posiciones as any).p1 ?? "").toUpperCase().trim();
    const btn_seat = seatForRole(posiciones, "BTN");
    if (hero_role !== "BTN" && btn_seat && (btn_seat === "p2" || btn_seat === "p3")) {
      const btn_bet = toNum((bets as any)[btn_seat]);
      if (btn_bet != null && btn_bet <= 0) {
        excluded_btn_seat = btn_seat;
      }
    }
  }

  const oppTotals: number[] = [];
  for (const seat of oppSeats) {
    if (excluded_btn_seat === seat) continue;
    const v = total(seat);
    if (v != null) oppTotals.push(v);
  }

  if (oppTotals.length === 0) {
    return {
      se_bb: null,
      hero_total,
      opp_max_total: null,
      excluded_btn_seat,
      reason: "missing_opponents",
    };
  }

  const opp_max_total = Math.max(...oppTotals);
  const se_bb = Math.min(hero_total, opp_max_total);
  if (!(se_bb >= 0.01 && se_bb <= 75.0)) {
    return {
      se_bb: null,
      hero_total,
      opp_max_total,
      excluded_btn_seat,
      reason: "out_of_range",
    };
  }

  return {
    se_bb: Math.round(se_bb * 100) / 100,
    hero_total,
    opp_max_total,
    excluded_btn_seat,
    reason: "ok",
  };
}

export type SpotPositions = { hero_pos: string; p2_pos: string; p3_pos: string };

export function extractSpotPositionsFromRawJson(raw_json?: string | null): SpotPositions | null {
  const raw = safeParseJson<any>(raw_json ?? null);
  const pos = raw?.preflop?.ocr?.posiciones;
  if (!pos || typeof pos !== "object") return null;
  return {
    hero_pos: String(pos.p1 ?? "").toUpperCase().trim(),
    p2_pos: String(pos.p2 ?? "").toUpperCase().trim(),
    p3_pos: String(pos.p3 ?? "").toUpperCase().trim(),
  };
}

export type FixBetsForMatchingResult = {
  p1_raw: number;
  p2_raw: number;
  p3_raw: number;
  p1_used: number;
  p2_used: number;
  p3_used: number;
  reason: string | null;
};

/** Frontend port of modules/workers/worker_strategy.py::_fix_bets_for_matching */
export function fixBetsForMatching(args: {
  hero_pos: string;
  bets_json?: string | null;
}): FixBetsForMatchingResult {
  const b = safeParseJson<Record<string, unknown>>(args.bets_json ?? null) ?? {};
  const p1 = toNum((b as any).p1) ?? 0;
  const p2 = toNum((b as any).p2) ?? 0;
  const p3 = toNum((b as any).p3) ?? 0;

  const hero = String(args.hero_pos || "").toUpperCase().trim();
  let reason = "";
  let p1_used = p1;
  if (hero === "BTN" && p1 >= 2.0 && p2 <= 1.0 && p3 <= 1.0) {
    p1_used = 0.0;
    reason = "btn_unacted_p1_bet_looks_like_pot";
  }

  return {
    p1_raw: p1,
    p2_raw: p2,
    p3_raw: p3,
    p1_used,
    p2_used: p2,
    p3_used: p3,
    reason: reason || null,
  };
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