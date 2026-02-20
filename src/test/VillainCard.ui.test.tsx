import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VillainCard from "../strategy/components/editor/VillainCard";
import type { SubStrategyPayload } from "../strategy/types";

function makePayload(): SubStrategyPayload {
  return {
    spot: "BTN",
    hero_pos: "BTN",

    p1_bet_min: 0,
    p1_bet_max: 0,
    p1_stack_min: 0,
    p1_stack_max: 0,
    p1_se_min: 0,
    p1_se_max: 0,

    p2_pos: "SB",
    p2_tipo: "fish",
    p2_bet_min: 1,
    p2_bet_max: 2,
    p2_stack_min: 10,
    p2_stack_max: 20,

    p3_pos: "BB",
    p3_tipo: "reg",
    p3_bet_min: 3,
    p3_bet_max: 4,
    p3_stack_min: 30,
    p3_stack_max: 40,

    situacion: "BTN_vs_SB_BB",
  };
}

describe("VillainCard", () => {
  it("cuando which='p2' parchea keys p2_* (pos/tipo)", () => {
    const patch = vi.fn();
    const value = makePayload();

    render(<VillainCard which="p2" title="P2" value={value} patch={patch} />);

    // Cambiar pos (select label 'pos')
    const posSelect = screen.getByLabelText("pos") as HTMLSelectElement;
    fireEvent.change(posSelect, { target: { value: "BTN" } });
    expect(patch).toHaveBeenCalledWith({ p2_pos: "BTN" });

    // Cambiar tipo (select label 'tipo')
    const tipoSelect = screen.getByLabelText("tipo") as HTMLSelectElement;
    fireEvent.change(tipoSelect, { target: { value: "reg" } });
    expect(patch).toHaveBeenCalledWith({ p2_tipo: "reg" });
  });

  it("cuando which='p3' parchea keys p3_* (bet min)", () => {
    const patch = vi.fn();
    const value = makePayload();

    render(<VillainCard which="p3" title="P3" value={value} patch={patch} />);

    const betMin = screen.getByLabelText("bet min") as HTMLInputElement;
    fireEvent.change(betMin, { target: { value: "9.999" } });

    // NumberField redondea a 2 decimales
    expect(patch).toHaveBeenCalled();
    const last = patch.mock.calls[patch.mock.calls.length - 1][0];
    expect(last).toEqual({ p3_bet_min: 10 });
  });
});
