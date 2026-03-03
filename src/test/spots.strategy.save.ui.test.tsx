import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock del repo DB
vi.mock("../db/spots", () => {
  return {
    updateStrategyPayload: vi.fn(async () => {}),
  };
});

import { updateStrategyPayload } from "../db/spots";
import SpotsStrategyEditor from "../pages/SpotsStrategyEditor";

const mockStrategy = {
  id: 1,
  name: "20_75_BB",
  payload_json: "{}"
};

describe("SpotsStrategyEditor save", () => {
  it("edits a field and calls updateStrategyPayload with NON-empty payload", async () => {
    render(<SpotsStrategyEditor strategy={mockStrategy} />);

    // Cambiamos P1 bet_min (primer input de P1 bet_min)
    // OJO: tu UI renderiza inputs en orden bet_min, bet_max... etc.
    const inputs = screen.getAllByRole("spinbutton");
    // El primer spinbutton debería ser p1.bet_min
    fireEvent.change(inputs[0], { target: { value: "9" } });

    // Guardar
    fireEvent.click(screen.getByText("Save Strategy"));

    // Assert: se llama
    expect((updateStrategyPayload as any).mock.calls.length).toBe(1);

    // Assert: payload tiene estructura y el valor editado
    const [calledId, calledPayload] = (updateStrategyPayload as any).mock.calls[0];
    expect(calledId).toBe(1);

    // Validamos que NO es {}
    expect(calledPayload).toBeTruthy();
    expect(typeof calledPayload).toBe("object");
    expect(calledPayload.p1).toBeTruthy();
    expect(calledPayload.p1.bet_min).toBe(9);

    // Y que OR blocks existen (estructura completa)
    expect(calledPayload.or_blocks).toBeTruthy();
    expect(calledPayload.or_blocks.OR_TO_CALL_ANY).toBeTruthy();
  });
});
