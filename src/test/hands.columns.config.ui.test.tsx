/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\hands.columns.config.ui.test.tsx
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HandsTable } from "../pages/hands/HandsTable";
import type { HandsObsRow } from "../db";

function makeRow(extra: Record<string, any> = {}): HandsObsRow {
  const ocr = {
    ocr: { stackefectivo: { value: 74 }, bets: { p1: 0, p2: 0.5, p3: 1 } },
    strategy: { move: "OR", bet_min_bb: 2.5, bet_max_bb: 2.5, situacion: "BTN_vs_SB_BB" },
    tempo_s: 1.234,
  };

  return {
    id: 123,
    fingerprint: "fp_1",
    table_id: "t_1",
    detected_at_ms: 1700000000000,
    mano_raw: "A4s",
    hand_class: "A4s",
    time_str: "x",
    preflop_ok: 1,
    noboard_ok: 1,
    ocr_json: JSON.stringify(ocr),
    p2bet: 0.5,
    p3bet: 1,
    frame_ref: "C:\\tmp\\img.bmp",
    ...extra,
  };
}

describe("HandsTable columns config", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows dynamic columns by default and allows hiding + persists selection", async () => {
    const user = userEvent.setup();

    const rows: HandsObsRow[] = [
      makeRow({
        // columna dinámica extra (no está en base)
        debug_extra_col: "hello",
      }),
    ];

    const { unmount } = render(<HandsTable rows={rows} />);

    // 1) Botón Config existe
    expect(screen.getByRole("button", { name: /config/i })).toBeTruthy();

    // 2) Columnas base visibles (headers)
    expect(screen.getByText("hand")).toBeTruthy();
    expect(screen.getByText("stackef")).toBeTruthy();
    expect(screen.getByText("move")).toBeTruthy();
    expect(screen.getByText("betmin")).toBeTruthy();
    expect(screen.getByText("betmax")).toBeTruthy();
    expect(screen.getByText("situacion")).toBeTruthy();

    // 3) Columnas dinámicas visibles (headers)
    expect(screen.getByText("fingerprint")).toBeTruthy();
    expect(screen.getByText("debug_extra_col")).toBeTruthy();

    // 4) Abrir modal Config
    await user.click(screen.getByRole("button", { name: /config/i }));
    expect(screen.getByText(/hands\s*–\s*columnas/i)).toBeTruthy();

    // 5) Desmarcar fingerprint usando el label con title="fingerprint" (único en el modal)
    const fingerprintLabel = screen.getByTitle("fingerprint");
    const checkbox = fingerprintLabel.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);

    // cerrar modal
    await user.click(screen.getByRole("button", { name: /cerrar/i }));

    // 6) fingerprint NO debe estar en el header (ya no hay modal)
    expect(screen.queryByText("fingerprint")).toBeNull();

    // 7) Persistencia: re-montar y comprobar que sigue oculto
    unmount();
    render(<HandsTable rows={rows} />);

    expect(screen.queryByText("fingerprint")).toBeNull();
    expect(screen.getByText("debug_extra_col")).toBeTruthy();
  });
});
