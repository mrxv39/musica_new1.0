import { describe, it, expect } from "vitest";
import type { SubStrategyPayload } from "../strategy/types";
import {
  clampNum,
  roundToStep,
  coerceMinMax,
  normalizePayload,
  makeSubId,
  formatSubLabel,
  specificityScore,
} from "../strategy/utils";

function basePayload(overrides: Partial<SubStrategyPayload> = {}): SubStrategyPayload {
  return {
    spot: "BTN",
    hero_pos: "BTN",

    p1_bet_min: 0,
    p1_bet_max: 75,
    p1_stack_min: 10,
    p1_stack_max: 50,
    p1_se_min: 5,
    p1_se_max: 20,

    p2_pos: "SB",
    p2_tipo: "unknown",
    p2_bet_min: 0,
    p2_bet_max: 75,
    p2_stack_min: 10,
    p2_stack_max: 50,

    p3_pos: "BB",
    p3_tipo: "unknown",
    p3_bet_min: 0,
    p3_bet_max: 75,
    p3_stack_min: 10,
    p3_stack_max: 50,

    situacion: "x",
    ...overrides,
  };
}

describe("strategy/utils.ts extra coverage", () => {
  it("clampNum: NaN => min y clamp dentro de bounds", () => {
    expect(clampNum(Number.NaN, 3, 9)).toBe(3);
    expect(clampNum(2, 3, 9)).toBe(3);
    expect(clampNum(10, 3, 9)).toBe(9);
    expect(clampNum(5, 3, 9)).toBe(5);
  });

  it("roundToStep: step<=0 o NaN => 0; redondea al step", () => {
    expect(roundToStep(10, 0)).toBe(0);
    expect(roundToStep(Number.NaN, 0.5)).toBe(0);
    expect(roundToStep(1.24, 0.5)).toBe(1);
    expect(roundToStep(1.26, 0.5)).toBe(1.5);
  });

  it("coerceMinMax: round+clamp y garantiza min<=max (swap)", () => {
    const r1 = coerceMinMax(10.2, 9.9, { min: 0, max: 9999, step: 0.5 });
    // 10.2 -> 10.0 ; 9.9 -> 10.0 (por step 0.5) => min=max=10
    expect(r1).toEqual({ min: 10, max: 10 });

    const r2 = coerceMinMax(6.2, 1.2, { min: 0, max: 9999, step: 0.5 });
    // 6.2->6.0 ; 1.2->1.0 => swap => min 1 max 6
    expect(r2).toEqual({ min: 1, max: 6 });
  });

  it("normalizePayload: fuerza situacion derivada y hace fallback defensivo", () => {
    const p = basePayload({
      hero_pos: "SB",
      p2_pos: "BB",
      p3_pos: "BTN",
      // fuerza valores raros para tocar fallback
      p1_bet_min: Number.NaN as any,
      p1_bet_max: Number.NaN as any,
    });

    const n = normalizePayload(p);
    expect(n.situacion).toBe("SB_vs_BB_BTN");
    expect(n.p1_bet_min).toBe(0);
    expect(n.p1_bet_max).toBe(0);
  });

  it("makeSubId: es determinista y se basa en payload NORMALIZADO", () => {
    const a = basePayload({ p1_stack_min: 10.2, p1_stack_max: 20.2 }); // -> 10, 20
    const b = basePayload({ p1_stack_min: 10.1, p1_stack_max: 20.1 }); // -> 10, 20

    expect(makeSubId(a)).toBe(makeSubId(b));

    // y si inviertes min/max, sigue dando el mismo id (por coerce swap)
    const c = basePayload({ p2_bet_min: 9.9, p2_bet_max: 1.2 }); // -> min 1 max 10
    const d = basePayload({ p2_bet_min: 1.2, p2_bet_max: 9.9 }); // -> min 1 max 10
    expect(makeSubId(c)).toBe(makeSubId(d));
  });

  it("formatSubLabel: omite bet si es default 0-75 y trunca con …", () => {
    const pDefault = basePayload({ hero_pos: "BTN", p2_tipo: "fish", p3_tipo: "reg" });
    const label1 = formatSubLabel(pDefault, 200);
    expect(label1.includes("bet")).toBe(false);
    expect(label1.includes("BTN vs SB/BB")).toBe(true);

    const pBet = basePayload({ p1_bet_max: 74.5 });
    const label2 = formatSubLabel(pBet, 200);
    expect(label2.includes("bet")).toBe(true);

    const label3 = formatSubLabel(pBet, 10);
    expect(label3.endsWith("…")).toBe(true);
  });

  it("specificityScore: más específico (rangos estrechos) => score mayor + bonus por tipo conocido", () => {
    const wideUnknown = basePayload({
      p2_tipo: "unknown",
      p3_tipo: "unknown",
      p1_stack_min: 0,
      p1_stack_max: 100,
    });

    const tightKnown = basePayload({
      p2_tipo: "reg",
      p3_tipo: "fish",
      p1_stack_min: 10,
      p1_stack_max: 10,
    });

    expect(specificityScore(tightKnown)).toBeGreaterThan(specificityScore(wideUnknown));
  });
});
