import { describe, expect, it, vi } from "vitest";

vi.mock("../pages/hands/handsPagePaths", () => ({
  SPOTS_OUT_BASE: "C:\\spots_base",
  yyyymmdd: (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  },
}));

import {
  ensureNonEmptyPath,
  getErrorMessage,
  buildWorkersOutDir,
  isWorkersRunningFromStatus,
} from "../pages/hands/handsPageUtils";

describe("handsPageUtils", () => {
  it("ensureNonEmptyPath returns trimmed value when non-empty", () => {
    expect(ensureNonEmptyPath("  C:\\db\\x.db  ", "fallback")).toBe("C:\\db\\x.db");
  });

  it("ensureNonEmptyPath returns fallback when emptyish", () => {
    expect(ensureNonEmptyPath("", "fallback")).toBe("fallback");
    expect(ensureNonEmptyPath("   ", "fallback")).toBe("fallback");
    expect(ensureNonEmptyPath(null, "fallback")).toBe("fallback");
    expect(ensureNonEmptyPath(undefined, "fallback")).toBe("fallback");
  });

  it("getErrorMessage returns string input as-is", () => {
    expect(getErrorMessage("boom")).toBe("boom");
  });

  it("getErrorMessage returns message field from object", () => {
    expect(getErrorMessage({ message: "bad things" })).toBe("bad things");
  });

  it("getErrorMessage falls back to String(e)", () => {
    expect(getErrorMessage(123)).toBe("123");
    expect(getErrorMessage(false)).toBe("false");
  });

  it("buildWorkersOutDir appends yyyyMMdd to SPOTS_OUT_BASE", () => {
    const d = new Date(2026, 2, 7);
    expect(buildWorkersOutDir(d)).toBe("C:\\spots_base\\20260307");
  });

  it("isWorkersRunningFromStatus detects running case-insensitively", () => {
    expect(isWorkersRunningFromStatus("workers running | pid=123")).toBe(true);
    expect(isWorkersRunningFromStatus("WORKERS RUNNING")).toBe(true);
    expect(isWorkersRunningFromStatus("idle")).toBe(false);
    expect(isWorkersRunningFromStatus("")).toBe(false);
  });
});
