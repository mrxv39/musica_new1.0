import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../pages/hands/handsPagePaths", () => ({
  CHAMPION_HERO: "xavieeee2",
  CHAMPION_XML_DIR: "C:\\xml\\dir",
  XML_ARCHIVE_DIR: "C:\\xml\\archive",
  summarize: (s: string) => s,
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  getErrorMessage: (e: unknown) => String(e),
}));

import { useHandsPageDataActions } from "../pages/hands/useHandsPageDataActions";

describe("useHandsPageDataActions", () => {
  const setBusy = vi.fn();
  const setActionStatus = vi.fn();
  const setLastLog = vi.fn();
  const loadObsOnce = vi.fn();
  const loadRealOnce = vi.fn();

  beforeEach(() => {
    invokeMock.mockReset();
    setBusy.mockReset();
    setActionStatus.mockReset();
    setLastLog.mockReset();
    loadObsOnce.mockReset();
    loadRealOnce.mockReset();
  });

  it("onReset in OBS calls reset_hands_obs and reloads obs", async () => {
    invokeMock.mockResolvedValue("reset ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "OBS",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onReset();
    });

    expect(invokeMock).toHaveBeenCalledWith("reset_spots", {
      dbPath: "C:\\db\\poker_boss.db",
    });
    expect(loadObsOnce).toHaveBeenCalledTimes(1);
    expect(loadRealOnce).not.toHaveBeenCalled();
  });

  it("onReset in REAL calls reset_hands and reloads real", async () => {
    invokeMock.mockResolvedValue("reset real ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onReset();
    });

    expect(invokeMock).toHaveBeenCalledWith("reset_hands", {
      dbPath: "C:\\db\\poker_boss.db",
    });
    expect(loadRealOnce).toHaveBeenCalledTimes(1);
    expect(loadObsOnce).not.toHaveBeenCalled();
  });

  it("onImportXml calls import_champion_xml with dbPath/xmlDir/archiveDir/hero", async () => {
    invokeMock.mockResolvedValue("import ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onImportXml();
    });

    expect(invokeMock).toHaveBeenCalledWith("import_champion_xml", {
      dbPath: "C:\\db\\poker_boss.db",
      xmlDir: "C:\\xml\\dir",
      archiveDir: "C:\\xml\\archive",
      hero: "xavieeee2",
    });
    expect(loadRealOnce).toHaveBeenCalledTimes(1);
  });

  it("onImportXml handles error and still clears busy", async () => {
    invokeMock.mockRejectedValue(new Error("import fail"));

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onImportXml();
    });

    expect(setLastLog).toHaveBeenCalledWith(expect.stringContaining("ERROR:"));
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });
});
