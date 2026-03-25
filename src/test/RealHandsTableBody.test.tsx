import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RealHandsTableBody from "../pages/hands/RealHandsTableBody";
import type { HandRealRow } from "../db";

function makeHand(overrides: Partial<HandRealRow> = {}): HandRealRow {
  return {
    id: 101,
    gamecode: "G-101",
    startdate: "2026-03-07 10:15:00",
    sb: 0.5,
    bb: 1,
    hero_cards: "HA DK",
    flop: "C2 D9 ST",
    turn: "HJ",
    river: "SQ",
    room: "Stars",
    hero: "hero1",
    players_json: '{"players":[]}',
    ...overrides,
  } as HandRealRow;
}

describe("RealHandsTableBody", () => {
  it("renderiza una fila por hand", () => {
    const rows = [
      makeHand({ id: 1, gamecode: "G-1" }),
      makeHand({ id: 2, gamecode: "G-2" }),
    ];

    render(
      <table>
        <RealHandsTableBody
          rows={rows}
          getSpotPng={() => "x.png"}
          onOpenHand={vi.fn()}
          onOpenImage={vi.fn()}
        />
      </table>
    );

    expect(screen.getByText("G-1")).toBeTruthy();
    expect(screen.getByText("G-2")).toBeTruthy();
  });

  it("click en la fila llama a onOpenHand", () => {
    const hand = makeHand();
    const onOpenHand = vi.fn();

    render(
      <table>
        <RealHandsTableBody
          rows={[hand]}
          getSpotPng={() => "x.png"}
          onOpenHand={onOpenHand}
          onOpenImage={vi.fn()}
        />
      </table>
    );

    fireEvent.click(screen.getByText("G-101"));
    expect(onOpenHand).toHaveBeenCalledTimes(1);
    expect(onOpenHand).toHaveBeenCalledWith(hand);
  });

  it("click en botón cámara llama a onOpenImage y no propaga a onOpenHand", () => {
    const hand = makeHand();
    const onOpenHand = vi.fn();
    const onOpenImage = vi.fn();

    render(
      <table>
        <RealHandsTableBody
          rows={[hand]}
          getSpotPng={() => "spot.png"}
          onOpenHand={onOpenHand}
          onOpenImage={onOpenImage}
        />
      </table>
    );

    fireEvent.click(screen.getByRole("button", { name: "📷" }));

    expect(onOpenImage).toHaveBeenCalledTimes(1);
    expect(onOpenImage).toHaveBeenCalledWith(hand);
    expect(onOpenHand).not.toHaveBeenCalled();
  });

  it("deshabilita cámara cuando no hay spot_png", () => {
    const hand = makeHand();

    render(
      <table>
        <RealHandsTableBody
          rows={[hand]}
          getSpotPng={() => ""}
          onOpenHand={vi.fn()}
          onOpenImage={vi.fn()}
        />
      </table>
    );

    const btn = screen.getByRole("button", { name: "📷" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("title")).toBe("Sin screenshot enlazado");
  });

  it("habilita cámara y pone title correcto cuando hay screenshot", () => {
    const hand = makeHand();

    render(
      <table>
        <RealHandsTableBody
          rows={[hand]}
          getSpotPng={() => "spot.png"}
          onOpenHand={vi.fn()}
          onOpenImage={vi.fn()}
        />
      </table>
    );

    const btn = screen.getByRole("button", { name: "📷" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("title")).toBe("Abrir screenshot (spot_png)");
  });

  it("muestra cards, board y room/hero formateados", () => {
    const hand = makeHand({
      hero_cards: "HA DK",
      flop: "C2 D9 ST",
      turn: "HJ",
      river: "SQ",
      room: "Winamax",
      hero: "pollo",
      tournament_name: "Sunday Special",
      tournament_code: "T123",
    });

    render(
      <table>
        <RealHandsTableBody
          rows={[hand]}
          getSpotPng={() => "spot.png"}
          onOpenHand={vi.fn()}
          onOpenImage={vi.fn()}
        />
      </table>
    );

    expect(screen.getByText(/Winamax \/ pollo/)).toBeTruthy();
    expect(screen.getByText(/Sunday Special \(T123\)/)).toBeTruthy();
    expect(screen.getByText(/Ah Kd/i)).toBeTruthy();
  });
});
