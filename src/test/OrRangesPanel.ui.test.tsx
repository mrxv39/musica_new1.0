import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrRangesPanel from "../strategy/components/OrRangesPanel";
import type { OrRangeRow } from "../strategy/types";

describe("OrRangesPanel", () => {
  it("click + Añadir => llama onChange con 1 fila", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<OrRangesPanel situationKey="BTN_vs_SB_BB" rows={[]} onChange={onChange} />);

    const btn = screen.getByRole("button", { name: /añadir/i });
    await user.click(btn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const rows = onChange.mock.calls[0][0] as OrRangeRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].range).toBe("ATs+");
    expect(rows[0].move).toBe("OR");
  });

  it("click − => elimina la fila", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const rows: OrRangeRow[] = [
      { id: "r1", range: "ATs+", move: "OR", value_min: 0, value_max: 0 },
    ];

    render(<OrRangesPanel situationKey="BTN_vs_SB_BB" rows={rows} onChange={onChange} />);

    const minus = screen.getByRole("button", { name: /eliminar fila/i });
    await user.click(minus);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([]);
  });
});
