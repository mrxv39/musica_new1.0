/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\VillainCard.ui.more.test.tsx
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import VillainCard from "../strategy/components/editor/VillainCard";

function makeValue(overrides: Partial<any> = {}) {
  return {
    // P2
    p2_pos: "BTN",
    p2_tipo: "reg",
    p2_bet_min: 1,
    p2_bet_max: 2,
    p2_stack_min: 10,
    p2_stack_max: 20,
    // P3
    p3_pos: "SB",
    p3_tipo: "fish",
    p3_bet_min: 3,
    p3_bet_max: 4,
    p3_stack_min: 30,
    p3_stack_max: 40,

    ...overrides,
  } as any;
}

// Similar a P1Card: intentamos accesible y si no, input cercano al label
function getInputNearLabel(labelText: string): HTMLInputElement {
  const labelNode = screen.getByText(labelText);
  const container =
    (labelNode.closest("label") as HTMLElement | null) ??
    (labelNode.parentElement as HTMLElement | null) ??
    (labelNode.closest("div") as HTMLElement | null);

  const input = container?.querySelector("input, select") as HTMLInputElement | null;
  if (!input) throw new Error(`No input/select found for label '${labelText}'`);
  return input;
}

function changeSelect(labelText: string, next: string) {
  const el = getInputNearLabel(labelText);
  fireEvent.change(el, { target: { value: next } });
}

function changeNumber(labelText: string, next: string) {
  const el = getInputNearLabel(labelText);
  fireEvent.change(el, { target: { value: next } });
}

describe("VillainCard", () => {
  it("p2: patches computed keys for selects and numbers", () => {
    const patch = vi.fn();
    render(<VillainCard which="p2" title="P2" value={makeValue()} patch={patch} />);

    // selects
    changeSelect("pos", "BB");
    expect(patch).toHaveBeenLastCalledWith({ p2_pos: "BB" });

    changeSelect("tipo", "unknown");
    expect(patch).toHaveBeenLastCalledWith({ p2_tipo: "unknown" });

    // numbers
    changeNumber("bet min", "5");
    expect(patch).toHaveBeenLastCalledWith({ p2_bet_min: 5 });

    changeNumber("bet max", "6");
    expect(patch).toHaveBeenLastCalledWith({ p2_bet_max: 6 });

    changeNumber("st min", "100");
    expect(patch).toHaveBeenLastCalledWith({ p2_stack_min: 100 });

    changeNumber("st max", "200");
    expect(patch).toHaveBeenLastCalledWith({ p2_stack_max: 200 });
  });

  it("p3: patches computed keys for selects and numbers", () => {
    const patch = vi.fn();
    render(<VillainCard which="p3" title="P3" value={makeValue()} patch={patch} />);

    changeSelect("pos", "BTN");
    expect(patch).toHaveBeenLastCalledWith({ p3_pos: "BTN" });

    changeSelect("tipo", "reg");
    expect(patch).toHaveBeenLastCalledWith({ p3_tipo: "reg" });

    changeNumber("bet min", "7");
    expect(patch).toHaveBeenLastCalledWith({ p3_bet_min: 7 });

    changeNumber("bet max", "8");
    expect(patch).toHaveBeenLastCalledWith({ p3_bet_max: 8 });

    changeNumber("st min", "300");
    expect(patch).toHaveBeenLastCalledWith({ p3_stack_min: 300 });

    changeNumber("st max", "400");
    expect(patch).toHaveBeenLastCalledWith({ p3_stack_max: 400 });
  });
});
