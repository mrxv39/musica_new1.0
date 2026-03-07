import { describe, expect, it } from "vitest";

import { safeParseJson, uniqStable } from "../pages/hands/handsTableUtils";

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
});
