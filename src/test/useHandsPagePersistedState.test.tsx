import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  DEFAULT_DB_PATH: "C:\\db\\default.db",
}));

import { useHandsPagePersistedState } from "../pages/hands/useHandsPagePersistedState";

describe("useHandsPagePersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useHandsPagePersistedState());

    expect(result.current.mode).toBe("OBS");
    expect(result.current.dbPath).toBe("C:\\db\\default.db");
    expect(result.current.auto).toBe(true);
    expect(result.current.canLoad).toBe(true);
  });

  it("hydrates mode/dbPath/auto from localStorage", () => {
    localStorage.setItem("hands.mode", "REAL");
    localStorage.setItem("dbPath", "C:\\db\\custom.db");
    localStorage.setItem("autoRefresh", "false");

    const { result } = renderHook(() => useHandsPagePersistedState());

    expect(result.current.mode).toBe("REAL");
    expect(result.current.dbPath).toBe("C:\\db\\custom.db");
    expect(result.current.auto).toBe(false);
    expect(result.current.canLoad).toBe(true);
  });

  it("normalizes invalid mode to OBS", () => {
    localStorage.setItem("hands.mode", "otro");

    const { result } = renderHook(() => useHandsPagePersistedState());

    expect(result.current.mode).toBe("OBS");
  });

  it("persists mode and auto when changed", async () => {
    const { result } = renderHook(() => useHandsPagePersistedState());

    await act(async () => {
      result.current.setMode("REAL");
      result.current.setAuto(false);
    });

    expect(localStorage.getItem("hands.mode")).toBe("REAL");
    expect(localStorage.getItem("autoRefresh")).toBe("false");
  });

  it("canLoad is false when dbPath is blank", async () => {
    const { result } = renderHook(() => useHandsPagePersistedState());

    await act(async () => {
      result.current.setDbPath("   ");
    });

    expect(result.current.canLoad).toBe(false);
  });
});
