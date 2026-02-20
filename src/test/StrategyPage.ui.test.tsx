import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../pages/strategy/db", () => {
  return {
    dbInit: vi.fn(async () => undefined),
    dbLoadSubs: vi.fn(async (_g: string) => ({ version: 1, globals: { BASE: { subs: [] } } })),
    dbSaveSub: vi.fn(async (_item: any) => ({ situationKey: "BTN_SB_BB_FISH_FISH", bucket: "20_75_BB" })),
  };
});

import * as db from "../pages/strategy/db";
import StrategyPage from "../pages/StrategyPage";

async function flush() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("StrategyPage (UI) - Guardado SQLite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.dbInit as any).mockResolvedValue(undefined);
    (db.dbLoadSubs as any).mockResolvedValue({ version: 1, globals: { BASE: { subs: [] } } });
    (db.dbSaveSub as any).mockResolvedValue({ situationKey: "BTN_SB_BB_FISH_FISH", bucket: "20_75_BB" });
  });

  it("al montar llama a dbInit() y dbLoadSubs()", async () => {
    render(<StrategyPage />);
    await flush();
    expect(db.dbInit).toHaveBeenCalledTimes(1);
    expect((db.dbLoadSubs as any).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("al pulsar Guardar subestrategia llama a dbSaveSub()", async () => {
    const user = userEvent.setup();
    render(<StrategyPage />);
    await flush();

    const btn = await screen.findByRole("button", { name: /guardar subestrategia/i });
    await user.click(btn);

    expect(db.dbSaveSub).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/guardado en sqlite/i)).toBeTruthy();
  });

  it("si dbSaveSub falla: muestra DB Save ERROR", async () => {
    const user = userEvent.setup();
    (db.dbSaveSub as any).mockRejectedValueOnce(new Error("boom"));

    render(<StrategyPage />);
    await flush();

    const btn = await screen.findByRole("button", { name: /guardar subestrategia/i });
    await user.click(btn);

    expect(await screen.findByText(/db save error/i)).toBeTruthy();
    expect(await screen.findByText(/boom/i)).toBeTruthy();
  });
});
