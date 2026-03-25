import { describe, expect, it } from "vitest";

import {
  formatCardToken,
  formatCardsString,
  formatBoardCompact,
} from "../pages/hands/realHandsFormatters";

describe("realHandsFormatters", () => {
  it("formatCardToken converts suit-first tokens", () => {
    expect(formatCardToken("CK")).toBe("Kc");
    expect(formatCardToken("D10")).toBe("Td");
    expect(formatCardToken("HA")).toBe("Ah");
    expect(formatCardToken("SQ")).toBe("Qs");
  });

  it("formatCardToken preserves X/XX as X", () => {
    expect(formatCardToken("X")).toBe("X");
    expect(formatCardToken("XX")).toBe("X");
  });

  it("formatCardToken returns empty string for empty input", () => {
    expect(formatCardToken("")).toBe("");
  });

  it("formatCardToken returns original-ish token when rank missing", () => {
    expect(formatCardToken("C")).toBe("C");
  });

  it("formatCardToken uses ? for unknown suit", () => {
    expect(formatCardToken("ZK")).toBe("K?");
  });

  it("formatCardsString formats multi-card strings", () => {
    expect(formatCardsString("HA CK")).toBe("Ah Kc");
    expect(formatCardsString("D10 SQ")).toBe("Td Qs");
  });

  it("formatCardsString returns dash for empty string", () => {
    expect(formatCardsString("")).toBe("-");
    expect(formatCardsString("   ")).toBe("-");
  });

  it("formatBoardCompact formats flop turn river compactly", () => {
    expect(formatBoardCompact("HA CK D10", "SQ", "C2")).toBe("F:Ah Kc Td T:Qs R:2c");
  });

  it("formatBoardCompact uses dashes when streets are missing", () => {
    expect(formatBoardCompact("", "", "")).toBe("F:- T:- R:-");
    expect(formatBoardCompact("HA CK D10", "", "")).toBe("F:Ah Kc Td T:- R:-");
  });
});
