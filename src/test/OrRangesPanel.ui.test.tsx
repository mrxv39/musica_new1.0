/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\OrRangesPanel.ui.test.tsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OrRangesPanel from "../strategy/components/OrRangesPanel";
import type { OrRanges } from "../strategy/types";

function emptyOr(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

function values(o: OrRanges): string[] {
  return [
    o.OR_TO_CALL_ANY,
    o.OPEN_PUSH,
    o.OR_TO_CALL_SMALL,
    o.OR_TO_FOLD,
  ];
}

describe("OrRangesPanel", () => {
  it("renderiza 4 inputs (OR strict)", () => {
    const onChange = vi.fn();
    render(
      <OrRangesPanel
        situationKey="BTN_vs_SB_BB"
        value={emptyOr()}
        onChange={onChange}
      />
    );

    // En el DOM actual, los 4 inputs comparten placeholder; es el selector más estable disponible ahora.
    const inputs = screen.getAllByPlaceholderText(
      /AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s/i
    );
    expect(inputs).toHaveLength(4);
  });

  it("al escribir llama onChange y devuelve OrRanges con 4 keys", () => {
    const onChange = vi.fn();
    render(
      <OrRangesPanel
        situationKey="BTN_vs_SB_BB"
        value={emptyOr()}
        onChange={onChange}
      />
    );

    const inputs = screen.getAllByPlaceholderText(
      /AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s/i
    ) as HTMLInputElement[];

    // Escribimos en el primer input (sin asumir qué key exacta es),
    // y comprobamos que el objeto devuelto contiene las 4 keys y que
    // al menos una recibió el valor.
    fireEvent.change(inputs[0], {
      target: { value: "AA-TT,AKs-A6s" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);

    const next = onChange.mock.calls[0][0] as OrRanges;

    // keys existen
    expect(next).toHaveProperty("OR_TO_CALL_ANY");
    expect(next).toHaveProperty("OPEN_PUSH");
    expect(next).toHaveProperty("OR_TO_CALL_SMALL");
    expect(next).toHaveProperty("OR_TO_FOLD");

    // alguna de las 4 refleja el input
    expect(values(next).some(v => v === "AA-TT,AKs-A6s")).toBe(true);
  });
});