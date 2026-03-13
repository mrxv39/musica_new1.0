import { beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.fn(async () => []);
const loadMock = vi.fn(async () => ({
  select: selectMock,
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: loadMock,
  },
}));

describe("fetchLatestHandsObs SQL contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the hand_links join and linked_gamecode alias in the query", async () => {
    const { fetchLatestHandsObs } = await import("../db");

    await fetchLatestHandsObs("C:\\fake\\obs.db", 50);

    expect(loadMock).toHaveBeenCalledWith("sqlite:C:\\fake\\obs.db");
    expect(selectMock).toHaveBeenCalledTimes(1);

    const [sql, params] = selectMock.mock.calls[0];
    expect(String(sql)).toContain("hand_links");
    expect(String(sql)).toContain("linked_gamecode");
    expect(String(sql)).toContain("LEFT JOIN");
    expect(params).toEqual([50]);
  });
});
