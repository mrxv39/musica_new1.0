/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\P1Card.ui.test.tsx
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import P1Card from "../strategy/components/editor/P1Card";

function makeValue(overrides: Partial<any> = {}) {
  return {
    p1_bet_min: 1,
    p1_bet_max: 2,
    p1_stack_min: 10,
    p1_stack_max: 20,
    p1_se_min: 0.1,
    p1_se_max: 0.9,
    ...overrides,
  } as any;
}

// Intento A: accesible (label->input)
// Fallback: buscamos el input cerca del texto del label
function getNumberInput(labelText: string): HTMLInputElement {
  try {
    return screen.getByLabelText(labelText) as HTMLInputElement;
  } catch {
    const labelNode = screen.getByText(labelText);
    const container =
      (labelNode.closest("label") as HTMLElement | null) ??
      (labelNode.parentElement as HTMLElement | null) ??
      (labelNode.closest("div") as HTMLElement | null);

    const input = container?.querySelector("input") as HTMLInputElement | null;
    if (!input) throw new Error(`No input found for label '${labelText}'`);
    return input;
  }
}

function changeNumber(input: HTMLInputElement, next: string) {
  fireEvent.change(input, { target: { value: next } });
}

describe("P1Card", () => {
  it("renders header and 6 fields", () => {
    render(<P1Card value={makeValue()} patch={() => {}} />);

    // Sin jest-dom: comprobamos existencia
    expect(screen.queryByText("P1 (hero env)")).toBeTruthy();

    expect(screen.queryByText("bet min")).toBeTruthy();
    expect(screen.queryByText("bet max")).toBeTruthy();
    expect(screen.queryByText("st min")).toBeTruthy();
    expect(screen.queryByText("st max")).toBeTruthy();
    expect(screen.queryByText("SE min")).toBeTruthy();
    expect(screen.queryByText("SE max")).toBeTruthy();
  });

  it("patches all six fields on change", () => {
    const patch = vi.fn();
    render(<P1Card value={makeValue()} patch={patch} />);

    changeNumber(getNumberInput("bet min"), "5");
    expect(patch).toHaveBeenLastCalledWith({ p1_bet_min: 5 });

    changeNumber(getNumberInput("bet max"), "6");
    expect(patch).toHaveBeenLastCalledWith({ p1_bet_max: 6 });

    changeNumber(getNumberInput("st min"), "100");
    expect(patch).toHaveBeenLastCalledWith({ p1_stack_min: 100 });

    changeNumber(getNumberInput("st max"), "200");
    expect(patch).toHaveBeenLastCalledWith({ p1_stack_max: 200 });

    changeNumber(getNumberInput("SE min"), "0.25");
    expect(patch).toHaveBeenLastCalledWith({ p1_se_min: 0.25 });

    changeNumber(getNumberInput("SE max"), "0.75");
    expect(patch).toHaveBeenLastCalledWith({ p1_se_max: 0.75 });
  });
});
