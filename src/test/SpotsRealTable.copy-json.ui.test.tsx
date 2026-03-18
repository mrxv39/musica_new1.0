import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}));

import { SpotsRealTable } from "../pages/hands/HandsFourTables";

describe("SpotsRealTable copy JSON", () => {
  it("copies spot JSON with debug_match", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_t: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    // Keep visible columns minimal; Copy column is always present.
    localStorage.setItem("hands.spots.visibleColumns", JSON.stringify(["id"]));

    const row: any = {
      id: 10,
      mesa: 3,
      image_path: "C:\\x.png",
      ts: "t",
      stacks_json: JSON.stringify({ p1: 20, p2: 50, p3: 10 }),
      bets_json: JSON.stringify({ p1: 3, p2: 1, p3: 1 }),
      names_json: "{}",
      tipo_p2: "fish",
      tipo_p3: "reg",
      time: 1.0,
      created_at: "now",
      raw_json: JSON.stringify({
        mano_result: { hand_class: "A6o" },
        preflop: { ocr: { posiciones: { p1: "BTN", p2: "SB", p3: "BB" } } },
      }),
      strategy_id: null,
      strategy_move: null,
      strategy_bet_min: null,
      strategy_bet_max: null,
    };

    render(<SpotsRealTable rows={[row]} />);

    await user.click(screen.getByTitle("Copiar JSON del spot"));

    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.spot.id).toBe(10);
    expect(parsed.derived.mano).toBe("A6o");
    expect(parsed.debug_match.hero_pos).toBe("BTN");
    expect(parsed.debug_match.p1_bet_bb_raw).toBe(3);
    // BTN heuristic triggers used=0
    expect(parsed.debug_match.p1_bet_bb_used).toBe(0);
    expect(typeof parsed.meta.copied_at).toBe("string");
  });
});

