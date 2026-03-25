import { describe, expect, it } from "vitest";

import {
  safeParseJson,
  uniqStable,
  getManoFromRawJson,
  computeEffectiveStackBbFromSpot,
  fixBetsForMatching,
} from "../pages/hands/handsTableUtils";

describe("handsTableUtils", () => {
  it("safeParseJson parses valid json object", () => {
    expect(safeParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("safeParseJson parses valid json array", () => {
    expect(safeParseJson<string[]>('["a","b"]')).toEqual(["a", "b"]);
  });

  it("safeParseJson returns null for null/empty/invalid", () => {
    expect(safeParseJson(null)).toBeNull();
    expect(safeParseJson("")).toBeNull();
    expect(safeParseJson("{bad")).toBeNull();
  });

  it("uniqStable removes duplicates preserving first appearance order", () => {
    expect(uniqStable(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });

  it("uniqStable returns empty array for empty input", () => {
    expect(uniqStable([])).toEqual([]);
  });

  describe("getManoFromRawJson", () => {
    it("prefers hand_class over mano_raw (e.g. 93o vs 9c3c)", () => {
      expect(
        getManoFromRawJson(
          JSON.stringify({ mano_result: { mano_raw: "9c3c", hand_class: "93o" } })
        )
      ).toBe("93o");
      expect(
        getManoFromRawJson(
          JSON.stringify({ mano_result: { mano_raw: "AhKh", hand_class: "AKs" } })
        )
      ).toBe("AKs");
    });

    it("falls back to mano_raw when hand_class is ?? or empty", () => {
      expect(
        getManoFromRawJson(
          JSON.stringify({ mano_result: { mano_raw: "9c3c", hand_class: "??" } })
        )
      ).toBe("9c3c");
      expect(
        getManoFromRawJson(
          JSON.stringify({ mano_result: { mano_raw: "AhKd", hand_class: "" } })
        )
      ).toBe("AhKd");
    });

    it("uses hand_class when mano_raw empty", () => {
      expect(
        getManoFromRawJson(JSON.stringify({ mano_result: { hand_class: "AKo" } }))
      ).toBe("AKo");
    });

    it("uses legacy mano when mano_raw and hand_class missing", () => {
      expect(
        getManoFromRawJson(JSON.stringify({ mano_result: { mano: "AH KH" } }))
      ).toBe("AH KH");
    });

    it("returns empty for missing mano_result or invalid json", () => {
      expect(getManoFromRawJson("{}")).toBe("");
      expect(getManoFromRawJson(null)).toBe("");
      expect(getManoFromRawJson("not json")).toBe("");
    });
  });

  describe("computeEffectiveStackBbFromSpot", () => {
    it("computes SE = min(p1_total, max(p2_total,p3_total)) using behind+bets", () => {
      const out = computeEffectiveStackBbFromSpot({
        stacks_json: JSON.stringify({ p1: 18, p2: 40, p3: 12 }),
        bets_json: JSON.stringify({ p1: 1, p2: 2, p3: 1 }),
        raw_json: null,
      });
      // totals: p1=19, p2=42, p3=13 -> max opp=42 -> se=min(19,42)=19
      expect(out.se_bb).toBe(19);
      expect(out.reason).toBe("ok");
    });

    it("excludes BTN seat when hero != BTN and BTN bet == 0", () => {
      const raw = JSON.stringify({ preflop: { ocr: { posiciones: { p1: "SB", p2: "BTN", p3: "BB" } } } });
      const out = computeEffectiveStackBbFromSpot({
        stacks_json: JSON.stringify({ p1: 20, p2: 50, p3: 10 }),
        bets_json: JSON.stringify({ p1: 1, p2: 0, p3: 1 }),
        raw_json: raw,
      });
      // totals: p1=21, p2=50 (excluded), p3=11 -> se=min(21,11)=11
      expect(out.excluded_btn_seat).toBe("p2");
      expect(out.se_bb).toBe(11);
    });

    it("returns null when missing p1 or opponents", () => {
      expect(
        computeEffectiveStackBbFromSpot({
          stacks_json: JSON.stringify({ p2: 10, p3: 10 }),
          bets_json: JSON.stringify({}),
          raw_json: null,
        }).se_bb
      ).toBeNull();
    });
  });

  describe("fixBetsForMatching", () => {
    it("sets p1_used=0 when hero BTN bet looks like pot", () => {
      const out = fixBetsForMatching({
        hero_pos: "BTN",
        bets_json: JSON.stringify({ p1: 3, p2: 1, p3: 1 }),
      });
      expect(out.p1_raw).toBe(3);
      expect(out.p1_used).toBe(0);
      expect(out.reason).toBe("btn_unacted_p1_bet_looks_like_pot");
    });

    it("keeps p1_used when conditions not met", () => {
      const out = fixBetsForMatching({
        hero_pos: "SB",
        bets_json: JSON.stringify({ p1: 3, p2: 1, p3: 1 }),
      });
      expect(out.p1_used).toBe(3);
      expect(out.reason).toBeNull();
    });
  });
});
