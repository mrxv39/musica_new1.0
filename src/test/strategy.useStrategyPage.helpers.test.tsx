import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildRows } from "../pages/strategy/orRangesAdapter";
import { defaultPayload, emptyStore, ensureGlobal } from "../pages/strategy/state";
import { useRowsSync } from "../pages/strategy/useStrategyPage/rowsSync";
import { useSubsCrud } from "../pages/strategy/useStrategyPage/useSubsCrud";

const makeIdMock = vi.fn();
const dbDeleteSubMock = vi.fn();

vi.mock("../pages/strategy/useStrategyPage/ids", () => ({
  makeId: () => makeIdMock(),
}));

vi.mock("../pages/strategy/db", () => ({
  dbDeleteSub: (...args: unknown[]) => dbDeleteSubMock(...args),
}));

function createStateSlot<T>(initial: T) {
  let value = initial;
  const setter = vi.fn((next: T | ((prev: T) => T)) => {
    value = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
  });
  return {
    setter,
    get value() {
      return value;
    },
  };
}

describe("pages/strategy/useStrategyPage helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("useRowsSync updates UI rows when payload changes and syncs payload back from rows", () => {
    const setEditorValue = vi.fn();
    const setOrRangesRows = vi.fn();

    const payload = defaultPayload();
    const nextPayload = {
      ...payload,
      orRanges: {
        ...payload.orRanges,
        OPEN_PUSH: "AA",
      },
    };

    const { result, rerender } = renderHook(
      ({ editorValue, orRangesRows }) =>
        useRowsSync({
          editorValue,
          setEditorValue,
          orRangesRows,
          setOrRangesRows,
        }),
      {
        initialProps: {
          editorValue: payload,
          orRangesRows: buildRows(payload.orRanges, payload.orRangesPlan),
        },
      }
    );

    rerender({
      editorValue: nextPayload,
      orRangesRows: buildRows(payload.orRanges, payload.orRangesPlan),
    });

    expect(setOrRangesRows).toHaveBeenCalledWith(buildRows(nextPayload.orRanges, nextPayload.orRangesPlan));

    const customRows = [
      {
        id: "OPEN_PUSH",
        label: "OPEN_PUSH",
        mode: "RAISE",
        bet_min: 12,
        bet_max: 18,
        range: "AKs",
      },
    ] as any;

    act(() => {
      result.current.setOrRangesRowsAndSync(customRows);
    });

    expect(setOrRangesRows).toHaveBeenCalledWith(customRows);
    expect(setEditorValue).toHaveBeenCalledTimes(1);

    const updater = setEditorValue.mock.calls[0][0] as (prev: any) => any;
    const synced = updater(payload);
    expect(synced.orRanges.OPEN_PUSH).toBe("AKs");
    expect(synced.orRangesPlan.OPEN_PUSH).toMatchObject({
      move: expect.any(String),
      bet_min_bb: expect.any(Number),
      bet_max_bb: expect.any(Number),
    });
  });

  it("useSubsCrud createNew and duplicateSelected update local state without touching DB", () => {
    makeIdMock.mockReturnValueOnce("new-sub").mockReturnValueOnce("copy-sub");

    const payload = {
      ...defaultPayload(),
      situacion: "BTN_vs_SB_BB",
    };

    const storeSlot = createStateSlot(ensureGlobal(emptyStore(), "default"));
    const subsSlot = createStateSlot<any[]>([]);
    const selectedIdSlot = createStateSlot<string | null>(null);
    const editorSlot = createStateSlot<any>(payload);
    const rowsSlot = createStateSlot<any[]>([]);
    const errorSlot = createStateSlot<string | null>("stale");
    const dirtyRef = { current: false };

    const { result } = renderHook(() =>
      useSubsCrud({
        globalName: "default",
        selectedId: selectedIdSlot.value,
        subsView: subsSlot.value,
        editorValue: payload,
        setIsLoading: vi.fn(),
        setError: errorSlot.setter,
        setStore: storeSlot.setter as any,
        setSubsView: subsSlot.setter as any,
        setSelectedId: selectedIdSlot.setter as any,
        setEditorValueClean: editorSlot.setter as any,
        setOrRangesRows: rowsSlot.setter as any,
        dirtyRef: dirtyRef as any,
      })
    );

    act(() => {
      result.current.createNew();
    });

    expect(subsSlot.value).toHaveLength(1);
    expect(subsSlot.value[0]).toMatchObject({ id: "new-sub", name: "Auto sub 1" });
    expect(storeSlot.value.globals.default.subs).toHaveLength(1);
    expect(selectedIdSlot.value).toBe("new-sub");
    expect(errorSlot.value).toBe(null);
    expect(dirtyRef.current).toBe(true);

    act(() => {
      result.current.duplicateSelected(subsSlot.value[0]);
    });

    expect(subsSlot.value).toHaveLength(2);
    expect(subsSlot.value[1]).toMatchObject({ id: "copy-sub", name: "Auto sub 1 (copy)" });
    expect(selectedIdSlot.value).toBe("copy-sub");
    expect(dbDeleteSubMock).not.toHaveBeenCalled();
  });

  it("useSubsCrud deleteSub resets editor when removing the selected last sub", async () => {
    dbDeleteSubMock.mockResolvedValueOnce(undefined);

    const payload = {
      ...defaultPayload(),
      situacion: "BTN_vs_SB_BB",
    };
    const item = {
      id: "sub-1",
      name: "sub 1",
      payload,
      or_ranges: buildRows(payload.orRanges, payload.orRangesPlan),
    } as any;

    const storeSlot = createStateSlot({
      globals: {
        default: {
          name: "default",
          subs: [item],
        },
      },
    } as any);
    const subsSlot = createStateSlot<any[]>([item]);
    const selectedIdSlot = createStateSlot<string | null>("sub-1");
    const editorSlot = createStateSlot<any>(payload);
    const rowsSlot = createStateSlot<any[]>(item.or_ranges);
    const errorSlot = createStateSlot<string | null>(null);
    const loadingSlot = createStateSlot<boolean>(false);
    const dirtyRef = { current: true };

    const { result } = renderHook(() =>
      useSubsCrud({
        globalName: "default",
        selectedId: selectedIdSlot.value,
        subsView: subsSlot.value,
        editorValue: payload,
        setIsLoading: loadingSlot.setter,
        setError: errorSlot.setter,
        setStore: storeSlot.setter as any,
        setSubsView: subsSlot.setter as any,
        setSelectedId: selectedIdSlot.setter as any,
        setEditorValueClean: editorSlot.setter as any,
        setOrRangesRows: rowsSlot.setter as any,
        dirtyRef: dirtyRef as any,
      })
    );

    await act(async () => {
      await result.current.deleteSub("sub-1");
    });

    expect(dbDeleteSubMock).toHaveBeenCalledWith("sub-1");
    expect(subsSlot.value).toEqual([]);
    expect(storeSlot.value.globals.default.subs).toEqual([]);
    expect(selectedIdSlot.value).toBe(null);
    expect(editorSlot.value).toMatchObject({ spot: "BTN", hero_pos: "BTN" });
    expect(rowsSlot.value).toHaveLength(4);
    expect(errorSlot.value).toBe("Eliminado");
    expect(loadingSlot.value).toBe(false);
    expect(dirtyRef.current).toBe(false);
  });

  it("useSubsCrud deleteSub keeps state and reports DB errors", async () => {
    dbDeleteSubMock.mockRejectedValueOnce(new Error("blocked"));

    const payload = {
      ...defaultPayload(),
      situacion: "BTN_vs_SB_BB",
    };
    const item = {
      id: "sub-2",
      name: "sub 2",
      payload,
      or_ranges: buildRows(payload.orRanges, payload.orRangesPlan),
    } as any;

    const storeSlot = createStateSlot({
      globals: {
        default: {
          name: "default",
          subs: [item],
        },
      },
    } as any);
    const subsSlot = createStateSlot<any[]>([item]);
    const selectedIdSlot = createStateSlot<string | null>("sub-2");
    const errorSlot = createStateSlot<string | null>(null);
    const loadingSlot = createStateSlot<boolean>(false);
    const dirtyRef = { current: true };

    const { result } = renderHook(() =>
      useSubsCrud({
        globalName: "default",
        selectedId: selectedIdSlot.value,
        subsView: subsSlot.value,
        editorValue: payload,
        setIsLoading: loadingSlot.setter,
        setError: errorSlot.setter,
        setStore: storeSlot.setter as any,
        setSubsView: subsSlot.setter as any,
        setSelectedId: selectedIdSlot.setter as any,
        setEditorValueClean: vi.fn() as any,
        setOrRangesRows: vi.fn() as any,
        dirtyRef: dirtyRef as any,
      })
    );

    await act(async () => {
      await result.current.deleteSub("sub-2");
    });

    expect(subsSlot.value).toHaveLength(1);
    expect(selectedIdSlot.value).toBe("sub-2");
    expect(errorSlot.value).toBe("DB Delete ERROR: blocked");
    expect(loadingSlot.value).toBe(false);
    expect(dirtyRef.current).toBe(true);
  });
});
