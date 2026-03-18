import { describe, expect, it } from "vitest";

import {
  safeParseJson,
  uniqStable,
  getManoFromRawJson,
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
});
