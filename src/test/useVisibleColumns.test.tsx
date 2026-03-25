import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useVisibleColumns } from "../pages/hands/useVisibleColumns";

describe("useVisibleColumns", () => {
  const columns = [
    { id: "time" },
    { id: "hand" },
    { id: "stackef" },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it("uses all columns by default and persists them", () => {
    const { result } = renderHook(() => useVisibleColumns(columns, "test.cols"));

    expect(result.current.visibleIds).toEqual(["time", "hand", "stackef"]);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(["time", "hand", "stackef"]);
    expect(localStorage.getItem("test.cols")).toBe(JSON.stringify(["time", "hand", "stackef"]));
  });

  it("hydrates visible ids from localStorage", () => {
    localStorage.setItem("test.cols", JSON.stringify(["hand", "stackef"]));

    const { result } = renderHook(() => useVisibleColumns(columns, "test.cols"));

    expect(result.current.visibleIds).toEqual(["hand", "stackef"]);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(["hand", "stackef"]);
  });

  it("onChangeVisibleIds removes duplicates and persists", async () => {
    const { result } = renderHook(() => useVisibleColumns(columns, "test.cols"));

    await act(async () => {
      result.current.onChangeVisibleIds(["hand", "hand", "time"]);
    });

    expect(result.current.visibleIds).toEqual(["hand", "time"]);
    expect(localStorage.getItem("test.cols")).toBe(JSON.stringify(["hand", "time"]));
  });

  it("repairs selection when columns change", () => {
    localStorage.setItem("test.cols", JSON.stringify(["hand", "old"]));

    const { result, rerender } = renderHook(
      ({ cols }) => useVisibleColumns(cols, "test.cols"),
      {
        initialProps: {
          cols: [
            { id: "time" },
            { id: "hand" },
          ],
        },
      }
    );

    expect(result.current.visibleIds).toEqual(["hand"]);

    rerender({
      cols: [
        { id: "time" },
        { id: "hand" },
        { id: "stackef" },
      ],
    });

    expect(result.current.visibleIds).toEqual(["hand"]);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(["hand"]);
  });

  it("falls back to all columns if saved json is invalid", () => {
    localStorage.setItem("test.cols", "{bad json");

    const { result } = renderHook(() => useVisibleColumns(columns, "test.cols"));

    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(["time", "hand", "stackef"]);
  });
});
