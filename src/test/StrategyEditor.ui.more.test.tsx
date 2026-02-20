/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\StrategyEditor.ui.more.test.tsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import StrategyEditor from "../strategy/components/StrategyEditor";
import type { SubStrategyPayload, OrRanges } from "../strategy/types";

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

    // ✅ requerido
    orRanges: {
      OR_TO_CALL_ANY: "",
      OPEN_PUSH: "",
      OR_TO_CALL_SMALL: "",
      OR_TO_FOLD: "",
    },
  };
}

const EMPTY_OR: OrRanges = {
  OR_TO_CALL_ANY: "",
  OPEN_PUSH: "",
  OR_TO_CALL_SMALL: "",
  OR_TO_FOLD: "",
};

describe("StrategyEditor UI extra coverage", () => {
  it("renders OR inputs without crashing (strict OR)", () => {
    const onChange = vi.fn();

    render(<StrategyEditor value={makePayload()} onChange={onChange} showOrPanel />);

    const inputs = screen.getAllByPlaceholderText(/AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s/i);
    expect(inputs).toHaveLength(4);
  });

  it("typing a VALID OR value triggers onChangeOrRanges (after blur)", async () => {
    const onChange = vi.fn();
    const onChangeOrRanges = vi.fn();
    const user = userEvent.setup();

    render(
      <StrategyEditor
        value={makePayload()}
        onChange={onChange}
        showOrPanel
        orRanges={EMPTY_OR}
        onChangeOrRanges={onChangeOrRanges}
      />
    );

    const inputs = screen.getAllByPlaceholderText(/AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s/i);

    await user.clear(inputs[0]);
    await user.type(inputs[0], "AA-TT");

    fireEvent.blur(inputs[0]);

    expect(onChangeOrRanges).toHaveBeenCalled();
  });
});
