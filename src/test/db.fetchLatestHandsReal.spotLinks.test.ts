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

describe("fetchLatestHandsReal spot_links contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads base hands and then reads spot_links frames by hand_id", async () => {
    selectMock
      .mockResolvedValueOnce([
        {
          id: 77,
          tournament_id: 500,
          tournament_name: "Sunday Special",
          tournament_code: "T123",
          gamecode: "G-77",
          hero_cards: "HA DK",
          linked_obs_id: 10,
        },
      ])
      .mockResolvedValueOnce([
        {
          hand_id: 77,
          gamecode: "G-77",
          spot_id: 701,
          spot_index: 1,
          street: "preflop",
          obs_id: 10,
          image_path: "C:\\spots\\frame1.bmp",
          mano_raw: "AhKd",
          hand_class: "AKo",
          match_score: 123,
          match_method: "spot_v1",
        },
        {
          hand_id: 77,
          gamecode: "G-77",
          spot_id: 702,
          spot_index: 2,
          street: "preflop",
          obs_id: 11,
          image_path: "C:\\spots\\frame2.bmp",
          mano_raw: "AhKd",
          hand_class: "AKo",
          match_score: 118,
          match_method: "spot_v1",
        },
      ]);

    const { fetchLatestHandsReal } = await import("../db");

    const rows = await fetchLatestHandsReal("C:\\fake\\real.db", 25);

    expect(loadMock).toHaveBeenCalledWith("sqlite:C:\\fake\\real.db");
    expect(selectMock).toHaveBeenCalledTimes(2);

    const [baseSql, baseParams] = selectMock.mock.calls[0];
    expect(String(baseSql)).toContain("FROM hands hr");
    expect(String(baseSql)).toContain("LEFT JOIN tournaments t");
    expect(String(baseSql)).toContain("t.tournamentname AS tournament_name");
    expect(String(baseSql)).toContain("t.tournamentcode AS tournament_code");
    expect(String(baseSql)).toContain("LEFT JOIN spots s");
    expect(baseParams).toEqual([25]);

    const [spotSql, spotParams] = selectMock.mock.calls[1];
    expect(String(spotSql)).toContain("FROM spot_links sl");
    expect(String(spotSql)).toContain("JOIN spots_xml_real sx");
    expect(String(spotSql)).toContain("JOIN spots h");
    expect(spotParams).toEqual([77]);

    expect(rows[0].spot_frames).toHaveLength(2);
    expect(rows[0].tournament_name).toBe("Sunday Special");
    expect(rows[0].tournament_code).toBe("T123");
    expect(rows[0].spot_frames?.[0]).toEqual(
      expect.objectContaining({
        hand_id: 77,
        spot_id: 701,
        spot_index: 1,
        obs_id: 10,
        image_path: "C:\\spots\\frame1.bmp",
        match_method: "spot_v1",
      })
    );
    expect(rows[0].spot_frames?.[1]).toEqual(
      expect.objectContaining({
        hand_id: 77,
        spot_id: 702,
        spot_index: 2,
        obs_id: 11,
        image_path: "C:\\spots\\frame2.bmp",
        match_method: "spot_v1",
      })
    );
  });
});
