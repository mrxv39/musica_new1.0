/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\hands.filters.cache.test.ts
import { describe, expect, test } from "vitest";
import { matchesPokerRangeList } from "../pages/hands/handsFilters";

describe("handsFilters rangeList cache", () => {
  test("same input multiple times is stable", () => {
    const list = "33-22,A9o-A2o,KJo-K8o";
    const a1 = matchesPokerRangeList("A9O", list);
    const a2 = matchesPokerRangeList("A9O", list);
    const a3 = matchesPokerRangeList("A9O", "  " + list + "   "); // trim should still match
    expect(a1.ok).toBe(true);
    expect(a1.match).toBe(true);
    expect(a2).toEqual(a1);
    expect(a3.ok).toBe(true);
    expect(a3.match).toBe(true);
  });

  test("different inputs do not leak", () => {
    expect(matchesPokerRangeList("A9O", "A9o-A2o").match).toBe(true);
    expect(matchesPokerRangeList("A9O", "K9s-K2s").match).toBe(false);
  });
});
