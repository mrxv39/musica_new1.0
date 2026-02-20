import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberField } from "../strategy/components/editor/EditorFields";

describe("EditorFields / NumberField", () => {
  it("redondea a 2 decimales (onChange) y fija a 2 decimales en blur", () => {
    const onChange = vi.fn();

    render(<NumberField label="bet min" value={0} onChange={onChange} />);

    const input = screen.getByLabelText("bet min") as HTMLInputElement;

    // change -> 1.239 => 1.24
    fireEvent.change(input, { target: { value: "1.239" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toBe(1.24);

    // blur -> vuelve a normalizar el valor actual
    onChange.mockClear();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalled();
    // blur usa value prop (0), se clamp/round igual (0)
    expect(onChange.mock.calls[0][0]).toBe(0);
  });

  it("cuando el input queda vacío, no revienta y devuelve 0", () => {
    const onChange = vi.fn();
    render(<NumberField label="st max" value={5} onChange={onChange} />);

    const input = screen.getByLabelText("st max") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toBe(0);
  });
});
