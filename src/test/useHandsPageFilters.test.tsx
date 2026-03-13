import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../pages/hands/handsFilters", () => ({
  parseNumericRange: (s: string) => (s ? { raw: s } : null),
  filterHandsByAllFilters: (
    rows: unknown[],
    stackEfRange: unknown,
    betRange: unknown,
    rangeListText: string,
    linkFilter: string
  ) => ({
    rows,
    rangeError: rangeListText === "BAD" ? "bad range" : "",
    meta: { stackEfRange, betRange, rangeListText, linkFilter },
  }),
}));

import { useHandsPageFilters } from "../pages/hands/useHandsPageFilters";

describe("useHandsPageFilters", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates filter texts from localStorage", () => {
    localStorage.setItem("hands.stackEfRangeText", "20-40");
    localStorage.setItem("hands.betRangeText", "2-3");
    localStorage.setItem("hands.rangeListText", "AJo-A2o");
    localStorage.setItem("hands.linkFilter", "linked");

    const { result } = renderHook(() => useHandsPageFilters([]));

    expect(result.current.stackEfRangeText).toBe("20-40");
    expect(result.current.betRangeText).toBe("2-3");
    expect(result.current.rangeListText).toBe("AJo-A2o");
    expect(result.current.linkFilter).toBe("linked");
  });

  it("persists each filter on change", async () => {
    const { result } = renderHook(() => useHandsPageFilters([]));

    await act(async () => {
      result.current.onChangeStackEfRangeText("10-20");
      result.current.onChangeBetRangeText("2-4");
      result.current.onChangeRangeListText("KQo-KTo");
      result.current.onChangeLinkFilter("unlinked");
    });

    expect(localStorage.getItem("hands.stackEfRangeText")).toBe("10-20");
    expect(localStorage.getItem("hands.betRangeText")).toBe("2-4");
    expect(localStorage.getItem("hands.rangeListText")).toBe("KQo-KTo");
    expect(localStorage.getItem("hands.linkFilter")).toBe("unlinked");
  });

  it("onClearFilters resets all texts", async () => {
    const { result } = renderHook(() => useHandsPageFilters([]));

    await act(async () => {
      result.current.onChangeStackEfRangeText("10-20");
      result.current.onChangeBetRangeText("2-4");
      result.current.onChangeRangeListText("KQo-KTo");
      result.current.onChangeLinkFilter("linked");
    });

    await act(async () => {
      result.current.onClearFilters();
    });

    expect(result.current.stackEfRangeText).toBe("");
    expect(result.current.betRangeText).toBe("");
    expect(result.current.rangeListText).toBe("");
    expect(result.current.linkFilter).toBe("all");
  });

  it("returns filtered payload using current texts", () => {
    const rows = [{ id: 1 } as never];
    const { result } = renderHook(() => useHandsPageFilters(rows));

    act(() => {
      result.current.onChangeStackEfRangeText("15-25");
      result.current.onChangeBetRangeText("2-3");
      result.current.onChangeRangeListText("AQo-AJo");
      result.current.onChangeLinkFilter("linked");
    });

    expect(result.current.filtered.rows).toEqual(rows);
    expect(result.current.filtered.rangeError).toBe("");
    expect((result.current.filtered as any).meta.linkFilter).toBe("linked");
  });

  it("surfaces rangeError from filter function", () => {
    const { result } = renderHook(() => useHandsPageFilters([]));

    act(() => {
      result.current.onChangeRangeListText("BAD");
    });

    expect(result.current.filtered.rangeError).toBe("bad range");
  });
});
