/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\hands.filters.allFilters.test.ts
import { describe, expect, test } from "vitest";
import type { HandsObsRow } from "../db";
import { filterHandsByAllFilters, parseNumericRange } from "../pages/hands/handsFilters";

function mkRow(id: number, handClass: string, stackEf: number, betMin: number, betMax: number): HandsObsRow {
  const ocr = {
    ocr: { stackefectivo: { value: stackEf } },
    strategy: { bet_min_bb: betMin, bet_max_bb: betMax },
  };
  return {
    id,
    hand_class: handClass,
    mano_raw: "",
    ocr_json: JSON.stringify(ocr),
  };
}

describe("parseNumericRange()", () => {
  test("empty -> null", () => {
    expect(parseNumericRange("")).toBe(null);
    expect(parseNumericRange("   ")).toBe(null);
  });

  test("single number -> min=max", () => {
    expect(parseNumericRange("20")).toEqual({ min: 20, max: 20 });
    expect(parseNumericRange("  3 ")).toEqual({ min: 3, max: 3 });
  });

  test("range normal + spaces", () => {
    expect(parseNumericRange("20-75")).toEqual({ min: 20, max: 75 });
    expect(parseNumericRange(" 20 - 75 ")).toEqual({ min: 20, max: 75 });
  });

  test("range reversed -> normalize", () => {
    expect(parseNumericRange("75-20")).toEqual({ min: 20, max: 75 });
  });

  test("invalid -> null", () => {
    expect(parseNumericRange("a-b")).toBe(null);
    expect(parseNumericRange("20-")).toBe(null);
    expect(parseNumericRange("-30")).toBe(null);
    expect(parseNumericRange("20-30-40")).toBe(null);
  });
});

describe("filterHandsByAllFilters()", () => {
  test("stackEf range filters inclusively", () => {
    const rows = [
      mkRow(1, "A9O", 19, 2, 3),
      mkRow(2, "A9O", 20, 2, 3),
      mkRow(3, "A9O", 75, 2, 3),
      mkRow(4, "A9O", 76, 2, 3),
    ];
    const res = filterHandsByAllFilters(rows, { min: 20, max: 75 }, null, "");
    expect(res.rows.map((r) => r.id)).toEqual([2, 3]);
  });

  test("bet range requires BOTH bet_min and bet_max inside range", () => {
    const rows = [
      mkRow(1, "A9O", 50, 1, 3), // bet_min fuera
      mkRow(2, "A9O", 50, 2, 4), // bet_max fuera
      mkRow(3, "A9O", 50, 2, 3), // ok
    ];
    const res = filterHandsByAllFilters(rows, null, { min: 2, max: 3 }, "");
    expect(res.rows.map((r) => r.id)).toEqual([3]);
  });

  test("dependent filters: stackEf AND bet AND rangeList", () => {
    const rows = [
      mkRow(1, "A9O", 30, 2, 3), // ok
      mkRow(2, "A5S", 30, 2, 3), // fuera por rangoList
      mkRow(3, "A9O", 10, 2, 3), // fuera por stackEf
      mkRow(4, "A9O", 30, 4, 5), // fuera por bet
    ];
    const res = filterHandsByAllFilters(rows, { min: 20, max: 75 }, { min: 2, max: 3 }, "A9o-A2o");
    expect(res.rows.map((r) => r.id)).toEqual([1]);
  });

  test("invalid rangeList returns rangeError but does not crash", () => {
    const rows = [mkRow(1, "A9O", 30, 2, 3)];
    const res = filterHandsByAllFilters(rows, { min: 20, max: 75 }, { min: 2, max: 3 }, "A9o-A2x");
    expect(res.rows.map((r) => r.id)).toEqual([1]);
    expect(Boolean(res.rangeError)).toBe(true);
  });
});
