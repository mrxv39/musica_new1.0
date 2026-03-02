import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SpotsStrategyEditor from "../pages/SpotsStrategyEditor";

const mockStrategy = {
  id: 1,
  name: "20_75_BB",
  payload_json: JSON.stringify({
    hero_pos: "BTN",
    p1: { bet_min: 1, bet_max: 2, st_min: 3, st_max: 4, se_min: 5, se_max: 6 },
    p2: { pos: "SB", tipo: "fish", bet_min: 7, bet_max: 8, st_min: 9, st_max: 10 },
    p3: { pos: "BB", tipo: "reg", bet_min: 11, bet_max: 12, st_min: 13, st_max: 14 },
    or_blocks: {
      OR_TO_CALL_ANY: { min: 15, max: 16, range: "AA" },
      OPEN_PUSH: { min: 17, max: 18, range: "KK" },
      OR_TO_CALL_SMALL: { min: 19, max: 20, range: "QQ" },
      OR_TO_FOLD: { min: 21, max: 22, range: "JJ" }
    }
  })
};

describe("SpotsStrategyEditor hydration", () => {
  it("loads payload into inputs and JSON modal", async () => {
    render(<SpotsStrategyEditor strategy={mockStrategy} />);

    // Inputs deben reflejar payload (si esto falla, NO está hidratando)
    expect(screen.getAllByDisplayValue("1").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("7").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("15").length).toBeGreaterThan(0);

    // Abrimos JSON
    fireEvent.click(screen.getByText("View JSON"));

    // Comprobamos texto en el modal (sin jest-dom)
    const jsonText1 = screen.getByText(/"bet_min":\s*1/);
    expect(jsonText1).toBeTruthy();

    const jsonText2 = screen.getByText(/"range":\s*"AA"/);
    expect(jsonText2).toBeTruthy();
  });
});
