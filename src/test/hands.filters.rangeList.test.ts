/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\hands.filters.rangeList.test.ts
import { describe, expect, test } from "vitest";
import { classifyHand, matchesPokerRangeList } from "../pages/hands/handsFilters";

// Nota: estos tests NO tocan DB, solo lógica pura.

describe("classifyHand()", () => {
  test("pairs", () => {
    expect(classifyHand("AsAd")).toBe("AA");
    expect(classifyHand("2h2c")).toBe("22");
    expect(classifyHand("TdTs")).toBe("TT");
  });

  test("suited/offsuit + orden", () => {
    expect(classifyHand("AhKh")).toBe("AKS");
    expect(classifyHand("AhKd")).toBe("AKO");
    // ordena aunque venga al revés
    expect(classifyHand("KhAd")).toBe("AKO");
    expect(classifyHand("7s9d")).toBe("97O");
    expect(classifyHand("9s7s")).toBe("97S");
  });

  test("invalid returns null", () => {
    expect(classifyHand("")).toBe(null);
    expect(classifyHand("??")).toBe(null);
    expect(classifyHand("A")).toBe(null);
  });
});

describe("matchesPokerRangeList()", () => {
  test("empty range => match true (no filter)", () => {
    expect(matchesPokerRangeList("AKO", "").ok).toBe(true);
    expect(matchesPokerRangeList("AKO", "").match).toBe(true);
  });

  test("exact tokens (AA / AKs / AKo)", () => {
    expect(matchesPokerRangeList("AA", "AA").match).toBe(true);
    expect(matchesPokerRangeList("KK", "AA").match).toBe(false);

    expect(matchesPokerRangeList("AKS", "AKs").match).toBe(true);
    expect(matchesPokerRangeList("AKO", "AKs").match).toBe(false);

    expect(matchesPokerRangeList("AKO", "AKo").match).toBe(true);
    expect(matchesPokerRangeList("AKS", "AKo").match).toBe(false);
  });

  test("pair ranges: 33-22 includes 33..22", () => {
    const range = "33-22";
    expect(matchesPokerRangeList("33", range).match).toBe(true);
    expect(matchesPokerRangeList("22", range).match).toBe(true);
    expect(matchesPokerRangeList("44", range).match).toBe(false);
  });

  test("offsuit ranges: A9o-A2o", () => {
    const range = "A9o-A2o";
    expect(matchesPokerRangeList("A9O", range).match).toBe(true);
    expect(matchesPokerRangeList("A2O", range).match).toBe(true);
    expect(matchesPokerRangeList("A5O", range).match).toBe(true);

    // no suited
    expect(matchesPokerRangeList("A5S", range).match).toBe(false);
    // no Ax fuera
    expect(matchesPokerRangeList("ATO", range).match).toBe(false);
    // no otra high card
    expect(matchesPokerRangeList("K9O", range).match).toBe(false);
  });

  test("suited ranges: K9s-K2s", () => {
    const range = "K9s-K2s";
    expect(matchesPokerRangeList("K9S", range).match).toBe(true);
    expect(matchesPokerRangeList("K2S", range).match).toBe(true);
    expect(matchesPokerRangeList("K5S", range).match).toBe(true);

    expect(matchesPokerRangeList("K5O", range).match).toBe(false);
    expect(matchesPokerRangeList("A5S", range).match).toBe(false);
  });

  test("mixed list with commas", () => {
    const list =
      "33-22,A9o-A2o,KJo-K8o,QJo-Q9o,JTo-J9o,T9o,K9s-K2s,Q9s-Q2s,J9s-J5s,T9s-T6s,98s-96s,87s-86s,76s-75s,65s-64s,54s";

    expect(matchesPokerRangeList("33", list).match).toBe(true);
    expect(matchesPokerRangeList("22", list).match).toBe(true);

    expect(matchesPokerRangeList("A2O", list).match).toBe(true);
    expect(matchesPokerRangeList("A9O", list).match).toBe(true);
    expect(matchesPokerRangeList("ATO", list).match).toBe(false);

    expect(matchesPokerRangeList("KJO", list).match).toBe(true);
    expect(matchesPokerRangeList("K8O", list).match).toBe(true);
    expect(matchesPokerRangeList("K7O", list).match).toBe(false);

    expect(matchesPokerRangeList("QJO", list).match).toBe(true);
    expect(matchesPokerRangeList("Q9O", list).match).toBe(true);
    expect(matchesPokerRangeList("Q8O", list).match).toBe(false);

    expect(matchesPokerRangeList("JTO", list).match).toBe(true);
    expect(matchesPokerRangeList("J9O", list).match).toBe(true);
    expect(matchesPokerRangeList("J8O", list).match).toBe(false);

    expect(matchesPokerRangeList("T9O", list).match).toBe(true);
    expect(matchesPokerRangeList("T8O", list).match).toBe(false);

    expect(matchesPokerRangeList("K9S", list).match).toBe(true);
    expect(matchesPokerRangeList("K2S", list).match).toBe(true);
    expect(matchesPokerRangeList("KTS", list).match).toBe(false);

    expect(matchesPokerRangeList("Q9S", list).match).toBe(true);
    expect(matchesPokerRangeList("Q2S", list).match).toBe(true);
    expect(matchesPokerRangeList("QTS", list).match).toBe(false);

    expect(matchesPokerRangeList("J9S", list).match).toBe(true);
    expect(matchesPokerRangeList("J5S", list).match).toBe(true);
    expect(matchesPokerRangeList("J4S", list).match).toBe(false);

    expect(matchesPokerRangeList("T9S", list).match).toBe(true);
    expect(matchesPokerRangeList("T6S", list).match).toBe(true);
    expect(matchesPokerRangeList("T5S", list).match).toBe(false);

    expect(matchesPokerRangeList("98S", list).match).toBe(true);
    expect(matchesPokerRangeList("96S", list).match).toBe(true);
    expect(matchesPokerRangeList("95S", list).match).toBe(false);

    expect(matchesPokerRangeList("87S", list).match).toBe(true);
    expect(matchesPokerRangeList("86S", list).match).toBe(true);
    expect(matchesPokerRangeList("85S", list).match).toBe(false);

    expect(matchesPokerRangeList("76S", list).match).toBe(true);
    expect(matchesPokerRangeList("75S", list).match).toBe(true);
    expect(matchesPokerRangeList("74S", list).match).toBe(false);

    expect(matchesPokerRangeList("65S", list).match).toBe(true);
    expect(matchesPokerRangeList("64S", list).match).toBe(true);
    expect(matchesPokerRangeList("63S", list).match).toBe(false);

    expect(matchesPokerRangeList("54S", list).match).toBe(true);
    expect(matchesPokerRangeList("54O", list).match).toBe(false);
  });

  test("invalid list => ok:false + error present", () => {
    const bad = "A9o-A2x"; // x inválido
    const res = matchesPokerRangeList("A9O", bad);
    expect(res.ok).toBe(false);
    expect(res.match).toBe(false);
    // error string no vacío
    // @ts-expect-error
    expect((res.error || "").length).toBeGreaterThan(0);
  });
});
