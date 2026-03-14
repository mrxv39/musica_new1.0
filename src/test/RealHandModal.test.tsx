import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RealHandModal from "../pages/hands/RealHandModal";
import type { HandRealRow, ActionRealRow } from "../db";

vi.mock("../db", async () => {
  const actual = await vi.importActual("../db");
  return {
    ...actual,
    fetchActionsRealForHand: vi.fn(),
  };
});

import { fetchActionsRealForHand } from "../db";

function makeHand(overrides: Partial<HandRealRow> = {}): HandRealRow {
  return {
    id: 77,
    gamecode: "G-77",
    startdate: "2026-03-07 12:00:00",
    sb: 0.5,
    bb: 1,
    hero_cards: "HA DK",
    flop: "C2 D9 ST",
    turn: "HJ",
    river: "SQ",
    room: "Stars",
    hero: "hero1",
    players_json: '{"players":[{"name":"hero1"}]}',
    ...overrides,
  } as HandRealRow;
}

function makeAction(overrides: Partial<ActionRealRow> = {}): ActionRealRow {
  return {
    id: 1,
    hand_id: 77,
    round_no: 1,
    action_no: 1,
    player: "hero1",
    type_name: "RAISE",
    sum_bb: 2.5,
    ...overrides,
  } as ActionRealRow;
}

describe("RealHandModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza si open=false", () => {
    render(
      <RealHandModal
        open={false}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText(/Hand/)).toBeNull();
  });

  it("no renderiza si hand=null", () => {
    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText(/Actions:/)).toBeNull();
  });

  it("al abrir llama a fetchActionsRealForHand con dbPath y hand.id", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand({ id: 77 })}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchActionsRealForHand).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(fetchActionsRealForHand).mock.calls[0];
    expect(firstCall[0]).toBe("C:\\db.sqlite");
    expect(firstCall[1]).toBe(77);
  });

  it("muestra estado ok y acciones agrupadas por calle", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([
      makeAction({ id: 1, round_no: 1, action_no: 1, player: "hero1", type_name: "RAISE", sum_bb: 2.5 }),
      makeAction({ id: 2, round_no: 2, action_no: 1, player: "villain", type_name: "CALL", sum_bb: 2.5 }),
      makeAction({ id: 3, round_no: 3, action_no: 1, player: "hero1", type_name: "BET", sum_bb: 3 }),
      makeAction({ id: 4, round_no: 4, action_no: 1, player: "villain", type_name: "FOLD", sum_bb: 0 }),
    ]);

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Actions:/)).toBeTruthy();

    await screen.findByText(/Actions:\s*ok \(4\)/i);

    expect(screen.getByText("PREFLOP")).toBeTruthy();
    expect(screen.getByText("FLOP")).toBeTruthy();
    expect(screen.getByText("TURN")).toBeTruthy();
    expect(screen.getByText("RIVER")).toBeTruthy();

    expect(screen.getAllByText(/hero1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/villain/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/#1\.1/)).toBeTruthy();
    expect(screen.getByText(/#2\.1/)).toBeTruthy();
    expect(screen.getByText(/#3\.1/)).toBeTruthy();
    expect(screen.getByText(/#4\.1/)).toBeTruthy();
  });

  it("muestra fallback cuando no hay acciones", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText(/Actions:\s*ok \(0\)/i);
    expect(
      screen.getByText(/No hay acciones en actions_real para esta mano\./)
    ).toBeTruthy();
  });

  it("muestra error cuando fetch falla", async () => {
    vi.mocked(fetchActionsRealForHand).mockRejectedValueOnce(new Error("db exploded"));

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText(/Actions:\s*ERROR:\s*db exploded/i);
  });

  it("botón Cerrar llama a onClose", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);
    const onClose = vi.fn();

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("click en overlay llama a onClose", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);
    const onClose = vi.fn();

    const { container } = render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={onClose}
      />
    );

    const overlay = container.firstChild as HTMLElement;
    fireEvent.mouseDown(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("click dentro del modal no cierra", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);
    const onClose = vi.fn();

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={onClose}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("muestra hero cards, board, OCR audit y players_json", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([]);

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand({
          hero_cards: "HA DK",
          flop: "C2 D9 ST",
          turn: "HJ",
          river: "SQ",
          tournament_name: "Sunday Special",
          tournament_code: "T123",
          players_json: '{"players":[{"name":"hero1"},{"name":"villain"}]}',
          ocr_audit_summary: "CARDS DIFF | WARN stacks",
          ocr_cards_match: false,
          ocr_mano_raw: "AdKd",
          ocr_match_method: "rank+time",
          ocr_match_score: 1,
          linked_obs_id: 55,
          wc_status: "errors",
          wc_reason: "ocr failed",
          stacks_ok: 0,
          bets_ok: 1,
          posiciones_ok: 1,
          dealer_ok: 1,
          table_state_ok: 1,
          ocr_warn_stacks: true,
          ocr_warn_bets: false,
          ocr_warn_pos: false,
          ocr_warn_dealer: false,
          ocr_warn_table: false,
        })}
        onClose={vi.fn()}
      />
    );

    await screen.findByText(/Actions:\s*ok \(0\)/i);

    expect(screen.getByText("Hero cards")).toBeTruthy();
    expect(screen.getByText("Board")).toBeTruthy();
    expect(screen.getByText(/Tournament:/)).toBeTruthy();
    expect(screen.getByText(/Sunday Special \(T123\)/)).toBeTruthy();
    expect(screen.getByText(/Flop:/)).toBeTruthy();
    expect(screen.getByText(/Turn:/)).toBeTruthy();
    expect(screen.getByText(/River:/)).toBeTruthy();

    expect(screen.getByText("OCR Audit")).toBeTruthy();
    expect(screen.getByText(/CARDS DIFF \| WARN stacks/i)).toBeTruthy();
    expect(screen.getByText(/Cards XML:/)).toBeTruthy();
    expect(screen.getByText(/Cards OCR:/)).toBeTruthy();
    expect(screen.getByText(/Cards result:/)).toBeTruthy();
    expect(screen.getByText(/Match method:/)).toBeTruthy();
    expect(screen.getByText(/Match score:/)).toBeTruthy();
    expect(screen.getByText(/Workers status:/)).toBeTruthy();
    expect(screen.getByText(/Workers reason:/)).toBeTruthy();
    expect(screen.getByText(/Stacks:/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Ver players_json/));
    expect(screen.getByText(/"name":"hero1"/)).toBeTruthy();
  });

  it("formatea cantidades bb y oculta 0bb", async () => {
    vi.mocked(fetchActionsRealForHand).mockResolvedValueOnce([
      makeAction({ id: 1, round_no: 1, action_no: 1, player: "hero1", type_name: "BET", sum_bb: 3 }),
      makeAction({ id: 2, round_no: 1, action_no: 2, player: "villain", type_name: "FOLD", sum_bb: 0 }),
    ]);

    render(
      <RealHandModal
        open={true}
        dbPath={"C:\\db.sqlite"}
        hand={makeHand()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText(/Actions:\s*ok \(2\)/i);
    expect(screen.getByText(/3bb/)).toBeTruthy();
    expect(screen.queryByText(/0bb/)).toBeNull();
  });
});
