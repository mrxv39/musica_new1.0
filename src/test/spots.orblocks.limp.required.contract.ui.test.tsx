import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

(globalThis as any).__spotsUpdateSpy = vi.fn(async () => {});

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
        payload_json: "{}", // empezamos vacío => el editor debe completar defaults
        created_at: "now",
      },
    ]),
    createSpot: vi.fn(async () => {}),
    deleteSpot: vi.fn(async () => true),
    createStrategy: vi.fn(async () => {}),
    updateStrategyPayload: (...args: any[]) => (globalThis as any).__spotsUpdateSpy(...args),
    deleteStrategy: vi.fn(async () => true),
    getStrategyById: vi.fn(async (id: number) => ({
      id,
      spot_id: 1,
      name: "20_75_BB",
      payload_json: "{}",
      created_at: "now",
    })),
  };
});

import SpotsPage from "../pages/SpotsPage";

describe("Spots OR blocks schema (contract)", () => {
  it("Save payload MUST include new LIMP_* blocks", async () => {
    (globalThis as any).__spotsUpdateSpy.mockClear();

    render(<SpotsPage />);

    // select spot
    const spot = await screen.findByText("Spot A");
    fireEvent.click(spot);

    // select strategy
    const strat = await screen.findByText("20_75_BB");
    fireEvent.click(strat);

    // edit something to ensure we trigger save with a non-empty payload
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "9" } });

    // save
    fireEvent.click(screen.getByText("Save Strategy"));

    const spy = (globalThis as any).__spotsUpdateSpy;
    expect(spy.mock.calls.length).toBe(1);

    const [_id, payload] = spy.mock.calls[0];

    // Existing OR blocks (sanity)
    expect(payload?.or_blocks?.OR_TO_CALL_ANY).toBeTruthy();
    expect(payload?.or_blocks?.OPEN_PUSH).toBeTruthy();
    expect(payload?.or_blocks?.OR_TO_CALL_SMALL).toBeTruthy();
    expect(payload?.or_blocks?.OR_TO_FOLD).toBeTruthy();

    // ✅ NEW required blocks (this is the point)
    expect(payload?.or_blocks?.LIMP_CALL_ANY).toBeTruthy();
    expect(payload?.or_blocks?.LIMP_CALL_SMALL).toBeTruthy();
    expect(payload?.or_blocks?.LIMP_FOLD).toBeTruthy();
  });
});
