import { describe, expect, it } from "vitest";

import {
  BATCH_FOLDER_PATH,
  PROJECT_ROOT,
  CHAMPION_XML_DIR,
  XML_ARCHIVE_DIR,
  SPOTS_OUT_BASE,
  CHAMPION_HERO,
  summarize,
  yyyymmdd,
} from "../pages/hands/handsPagePaths";

describe("handsPagePaths", () => {
  it("exports non-empty key paths/constants", () => {
    expect(BATCH_FOLDER_PATH.length).toBeGreaterThan(0);
    expect(PROJECT_ROOT.length).toBeGreaterThan(0);
    expect(CHAMPION_XML_DIR.length).toBeGreaterThan(0);
    expect(XML_ARCHIVE_DIR.length).toBeGreaterThan(0);
    expect(SPOTS_OUT_BASE.length).toBeGreaterThan(0);
    expect(CHAMPION_HERO).toBe("xavieeee2");
  });

  it("XML_ARCHIVE_DIR and SPOTS_OUT_BASE are derived from PROJECT_ROOT", () => {
    expect(XML_ARCHIVE_DIR.startsWith(PROJECT_ROOT)).toBe(true);
    expect(SPOTS_OUT_BASE.startsWith(PROJECT_ROOT)).toBe(true);
  });

  it("summarize collapses whitespace", () => {
    expect(summarize(" hola   mundo \n test ")).toBe("hola mundo test");
  });

  it("summarize returns empty string for emptyish input", () => {
    expect(summarize("")).toBe("");
    expect(summarize("   ")).toBe("");
  });

  it("summarize truncates long strings with ellipsis", () => {
    const s = "abcdefghij";
    expect(summarize(s, 5)).toBe("abcde …");
  });

  it("yyyymmdd formats date correctly", () => {
    expect(yyyymmdd(new Date(2026, 2, 7))).toBe("20260307");
    expect(yyyymmdd(new Date(2026, 10, 19))).toBe("20261119");
  });
});
