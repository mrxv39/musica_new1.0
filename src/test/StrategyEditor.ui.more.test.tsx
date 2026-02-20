/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\StrategyEditor.ui.more.test.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ✅ SIN alias @/ (en FAST puede no estar disponible)
import StrategyEditor from "../strategy/components/StrategyEditor";
import type { SubStrategyPayload } from "../strategy/types";

function makePayload(): SubStrategyPayload {
  return {
    spot: "BTN",

    hero_pos: "BTN",

    // P1 (Hero) defaults
    p1_bet_min: 0,
    p1_bet_max: 75,
    p1_stack_min: 0,
    p1_stack_max: 75,
    p1_se_min: 0,
    p1_se_max: 75,

    // P2
    p2_pos: "SB",
    p2_tipo: "reg",
    p2_bet_min: 0,
    p2_bet_max: 75,
    p2_stack_min: 0,
    p2_stack_max: 75,

    // P3
    p3_pos: "BB",
    p3_tipo: "fish",
    p3_bet_min: 0,
    p3_bet_max: 75,
    p3_stack_min: 0,
    p3_stack_max: 75,

    situacion: "BTN_vs_SB_BB",
  };
}

describe("StrategyEditor UI extra coverage", () => {
  it("renders add button without crashing", () => {
    const onChange = vi.fn();

    render(
      <StrategyEditor value={makePayload()} onChange={onChange} showOrPanel />
    );

    const btn = screen.getByRole("button", { name: /añadir/i });
    expect(btn).toBeTruthy();
  });

  it("updates situacion when hero pos changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StrategyEditor value={makePayload()} onChange={onChange} showOrPanel />
    );

    const heroPos = screen.getByLabelText("Hero pos");
    await user.selectOptions(heroPos, "SB");

    expect(onChange).toHaveBeenCalled();

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];

    // ✅ Ahora sí: p2_pos/p3_pos existen, así que debe calcular bien
    expect(lastCall.situacion).toBe("SB_vs_SB_BB");
  });
});
