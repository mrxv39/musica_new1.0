import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HandsTable } from "../pages/hands/HandsTable";
import type { HandsObsRow } from "../db";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

function makeRow(id: number, extra: Record<string, any> = {}): HandsObsRow {
  return {
    id,
    obs_id: id,
    detected_at_ms: 1700000000000 + id,
    mano_raw: `A${id}s`,
    hand_class: `A${id}s`,
    ocr_json: JSON.stringify({
      ocr: {
        stackefectivo: { value: 74 },
        bets: { p1: 0, p2: 0.5, p3: 1 },
      },
      strategy: {
        ok: false,
        error:
          "ValueError: Expected exactly 1 match, got 0. matched_ids=[]. top_nonmatch_reasons=[('spot', 28)]. requested_situacion='BB_vs_CO_SB_20bb'.",
        matched_ids: [],
        top_nonmatch_reasons: [["spot", 28]],
        requested_situacion: "BB_vs_CO_SB_20bb",
      },
      tempo_s: 1.234,
    }),
    frame_ref: `C:\\tmp\\img-${id}.bmp`,
    ...extra,
  };
}

describe("HandsTable image preview", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the full strategy reason and navigates only across rows with image", async () => {
    const user = userEvent.setup();
    const rows: HandsObsRow[] = [
      makeRow(1, { captured_gamecode: "GC1", linked_hand_id: 101, match_method: "gamecode" }),
      makeRow(2, { frame_ref: "" }),
      makeRow(3, { unlink_reason: "No candidate in hand_links", captured_gamecode: "" }),
    ];

    render(
      <HandsTable
        rows={rows}
        canRunOne={false}
        onRunOneForImage={vi.fn(async () => "")}
      />
    );

    await user.click(screen.getAllByText("view")[1]);

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("Motivo por el cual no se pudo relacionar")).toBeTruthy();
    expect(screen.getByText("Diagnóstico de estrategia (rangos preflop)")).toBeTruthy();
    expect(screen.getByText(/Detalle del fallo de estrategia \(no afecta al enlace OBSREAL\)\./)).toBeTruthy();
    expect(screen.getByText(/el enlace OBSREAL se diagnostica en el bloque 'Motivo por el cual no se pudo relacionar'/)).toBeTruthy();
    expect(screen.getByText(/No candidate in hand_links/)).toBeTruthy();
    expect(screen.getAllByText(/top_nonmatch_reasons/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/requested_situacion/).length).toBeGreaterThan(0);
    expect(screen.getByText(/captured_gamecode vacio/)).toBeTruthy();
    expect(screen.queryAllByText(/No candidate in hand_links/).length).toBe(1);
    expect(screen.queryAllByText(/captured_gamecode vacio/).length).toBe(1);

    await user.click(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getAllByText("C:\\tmp\\img-1.bmp").length).toBeGreaterThan(0);
    expect(screen.queryByText("Motivo por el cual no se pudo relacionar")).toBeNull();
    expect(screen.getByText("Diagnóstico de estrategia (rangos preflop)")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getAllByText("C:\\tmp\\img-3.bmp").length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByText("2 / 2")).toBeNull();
  }, 15000);

  it("shows the renamed strategy diagnostic block for 1 hand output", async () => {
    const user = userEvent.setup();
    const rows: HandsObsRow[] = [makeRow(1)];
    const runOutput = JSON.stringify({
      strategy: {
        ok: false,
        error: "ValueError: Expected exactly 1 match, got 0.",
        requested_situacion: "BB_vs_CO_SB_20bb",
        top_nonmatch_reasons: [["p2_tipo", 18]],
      },
    });

    render(
      <HandsTable
        rows={rows}
        canRunOne={true}
        onRunOneForImage={vi.fn(async () => runOutput)}
      />
    );

    await user.click(screen.getByText("view"));
    await user.click(screen.getByRole("button", { name: "1 hand" }));

    expect(screen.getByText("Diagnóstico de estrategia (1 hand)")).toBeTruthy();
    expect(screen.getByText(/Detalle del fallo de estrategia para esta imagen\./)).toBeTruthy();
    expect(screen.getByText(/el enlace OBSREAL se diagnostica en el bloque 'Motivo por el cual no se pudo relacionar'/)).toBeTruthy();
    expect(screen.queryByText("Motivo por el cual no se pudo relacionar")).toBeNull();
  }, 15000);
});
