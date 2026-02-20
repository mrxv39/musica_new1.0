import { describe, expect, test } from "vitest";
import { asUiSub, getUiName, getUiTimeKey, nowIso, uid } from "../pages/strategy/model";
import type { SubStrategyItem } from "../strategy/types";

function sub(overrides: Partial<SubStrategyItem> = {}): SubStrategyItem {
  // Construimos un objeto mínimo y lo “forzamos” al tipo core.
  // Este test valida comportamiento UI (casts) no el shape completo del core.
  return ({ ...overrides } as unknown) as SubStrategyItem;
}

describe("pages/strategy/model", () => {
  test("uid() returns a stable prefix and is unique across calls", () => {
    const a = uid();
    const b = uid();
    expect(a.startsWith("sub_")).toBe(true);
    expect(b.startsWith("sub_")).toBe(true);
    expect(a).not.toBe(b);
  });

  test("nowIso() returns an ISO date string parseable by Date.parse", () => {
    const s = nowIso();
    expect(typeof s).toBe("string");
    expect(Number.isNaN(Date.parse(s))).toBe(false);
    // chequeo suave: ISO suele empezar por '20'
    expect(s.startsWith("20")).toBe(true);
  });

  test("asUiSub() is an identity cast (same reference)", () => {
    const x = sub({} as any);
    const y = asUiSub(x);
    expect(y).toBe(x);
  });

  test("getUiName() returns trimmed non-empty name when present", () => {
    const x = sub({} as any) as any;
    x.name = "  Mi estrategia  ";
    expect(getUiName(x, "fallback")).toBe("  Mi estrategia  ");
  });

  test("getUiName() falls back when name is empty/whitespace", () => {
    const x = sub({} as any) as any;
    x.name = "   ";
    expect(getUiName(x, "fallback")).toBe("fallback");
  });

  test("getUiName() falls back when name is not a string or missing", () => {
    const a = sub({} as any) as any;
    a.name = 123;
    expect(getUiName(a, "fallback")).toBe("fallback");

    const b = sub({} as any) as any;
    expect(getUiName(b, "fallback")).toBe("fallback");
  });

  test("getUiTimeKey() prefers updatedAt over createdAt, otherwise empty", () => {
    const x = sub({} as any) as any;

    x.createdAt = "2026-01-01T00:00:00.000Z";
    expect(getUiTimeKey(x)).toBe("2026-01-01T00:00:00.000Z");

    x.updatedAt = "2026-02-01T00:00:00.000Z";
    expect(getUiTimeKey(x)).toBe("2026-02-01T00:00:00.000Z");

    x.updatedAt = "";
    x.createdAt = "";
    expect(getUiTimeKey(x)).toBe("");
  });

  test("getUiTimeKey() ignores non-string values", () => {
    const x = sub({} as any) as any;

    x.updatedAt = 123;
    x.createdAt = 456;
    expect(getUiTimeKey(x)).toBe("");
  });
});