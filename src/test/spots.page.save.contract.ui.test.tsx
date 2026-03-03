import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// ✅ Vitest hoists vi.mock: usamos globalThis para acceder al spy de forma segura
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
        payload_json: "{}",
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

describe("SpotsPage save round-trip (contract)", () => {
  it("edit a field and Save calls updateStrategyPayload with correct id and payload", async () => {
    // reset spy por si reruns
    (globalThis as any).__spotsUpdateSpy.mockClear();

    render(<SpotsPage />);

    // select spot
    const spot = await screen.findByText("Spot A");
    fireEvent.click(spot);

    // select strategy
    const strat = await screen.findByText("20_75_BB");
    fireEvent.click(strat);

    // edit: primer spinbutton (p1.bet_min) -> 9
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "9" } });

    // save
    fireEvent.click(screen.getByText("Save Strategy"));

    const spy = (globalThis as any).__spotsUpdateSpy;
    expect(spy.mock.calls.length).toBe(1);

    const [calledId, calledPayload] = spy.mock.calls[0];
    expect(calledId).toBe(10);
    expect(calledPayload?.p1?.bet_min).toBe(9);
    expect(calledPayload?.or_blocks?.OR_TO_CALL_ANY).toBeTruthy();
  });
});
