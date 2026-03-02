import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock completo del repo spots
vi.mock("../db/spots", () => {
  return {
    initSpotsDB: vi.fn(async () => {}),
    listSpots: vi.fn(async () => [
      { id: 1, name: "Spot A", description: null, created_at: "now" },
    ]),
    listStrategiesForSpot: vi.fn(async (_spotId: number) => [
      {
        id: 10,
        spot_id: 1,
        name: "20_75_BB",
        payload_json: JSON.stringify({
          hero_pos: "BTN",
          p1: { bet_min: 9, bet_max: 2, st_min: 3, st_max: 4, se_min: 5, se_max: 6 },
          p2: { pos: "SB", tipo: "fish", bet_min: 7, bet_max: 8, st_min: 9, st_max: 10 },
          p3: { pos: "BB", tipo: "reg", bet_min: 11, bet_max: 12, st_min: 13, st_max: 14 },
          or_blocks: {
            OR_TO_CALL_ANY: { min: 15, max: 16, range: "AA" },
            OPEN_PUSH: { min: 17, max: 18, range: "KK" },
            OR_TO_CALL_SMALL: { min: 19, max: 20, range: "QQ" },
            OR_TO_FOLD: { min: 21, max: 22, range: "JJ" }
          }
        }),
        created_at: "now",
      },
    ]),
    createSpot: vi.fn(async () => {}),
    deleteSpot: vi.fn(async () => true),
    createStrategy: vi.fn(async () => {}),
    updateStrategyPayload: vi.fn(async () => {}),
    deleteStrategy: vi.fn(async () => true),
    getStrategyById: vi.fn(async (id: number) => ({
      id,
      spot_id: 1,
      name: "20_75_BB",
      payload_json: JSON.stringify({ p1: { bet_min: 9 } }),
      created_at: "now",
    })),
  };
});

import SpotsPage from "../pages/SpotsPage";

describe("SpotsPage selection -> editor hydration", () => {
  it("click Spot, then click strategy, loads payload into editor + JSON", async () => {
    render(<SpotsPage />);

    // 1) Aparece el spot
    const spot = await screen.findByText("Spot A");
    expect(spot).toBeTruthy();

    // 2) Seleccionamos spot (esto dispara listStrategiesForSpot)
    fireEvent.click(spot);

    // 3) Ahora deben aparecer strategies
    const strat = await screen.findByText("20_75_BB");
    expect(strat).toBeTruthy();

    // 4) Click strategy -> hidrata editor
    fireEvent.click(strat);

    // bet_min=9 debe aparecer en algún input number
    const values9 = await screen.findAllByDisplayValue("9");
    expect(values9.length).toBeGreaterThan(0);

    // JSON modal debe contener bet_min 9
    fireEvent.click(screen.getByText("View JSON"));
    expect(screen.getByText(/"bet_min":\s*9/)).toBeTruthy();
  });
});
