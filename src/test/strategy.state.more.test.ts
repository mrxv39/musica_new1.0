/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.state.more.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del módulo que state.ts importa como "./model"
vi.mock("../pages/strategy/model", () => {
  return {
    getUiTimeKey: (item: any) => item.__k ?? null,
  };
});

import { ensureGlobal, getSubsArray, listSubs } from "../pages/strategy/state";

describe("pages/strategy/state ensureGlobal", () => {
  it("repairs missing globals and missing global entry", () => {
    const store: any = {};
    const next = ensureGlobal(store, "default") as any;

    expect(next).toBeTruthy();
    expect(next.globals).toBeTruthy();
    expect(next.globals.default).toBeTruthy();
    expect(next.globals.default.name).toBe("default");
    expect(Array.isArray(next.globals.default.subs)).toBe(true);
  });

  it("repairs non-array subs to []", () => {
    const store: any = {
      globals: {
        default: {
          name: "default",
          subs: "NOT_AN_ARRAY",
        },
      },
    };

    const next = ensureGlobal(store, "default") as any;

    expect(Array.isArray(next.globals.default.subs)).toBe(true);
    expect(next.globals.default.subs.length).toBe(0);

    const arr = getSubsArray(next, "default");
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(0);
  });
});

describe("pages/strategy/state listSubs sort branches", () => {
  beforeEach(() => {
    // nada, pero dejamos el hook por si en el futuro añadimos spies
  });

  it("sorts by getUiTimeKey descending when both keys exist and differ", () => {
    const store: any = {
      globals: {
        default: {
          name: "default",
          subs: [
            { id: "a", __k: "2026-01-01" },
            { id: "b", __k: "2026-02-01" },
          ],
        },
      },
    };

    const out = listSubs(store, "default");
    expect(out.map((x: any) => x.id)).toEqual(["b", "a"]);
  });

  it("returns 0 in comparator when keys are missing (stable order)", () => {
    const store: any = {
      globals: {
        default: {
          name: "default",
          subs: [
            { id: "a" }, // __k undefined => null
            { id: "b" }, // __k undefined => null
          ],
        },
      },
    };

    const out = listSubs(store, "default");
    expect(out.map((x: any) => x.id)).toEqual(["a", "b"]);
  });
});
