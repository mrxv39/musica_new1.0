import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ✅ MOCK db/sql: crea fns dentro del factory (evita hoist + TDZ)
vi.mock("../db/sql", () => {
  return {
    initDB: vi.fn(async () => undefined),
    upsertSituationKey: vi.fn(async (_key: string) => 123),
    ensureBucketsForSituation: vi.fn(async (_id: number) => undefined),
    upsertSubStrategy: vi.fn(async () => undefined),
    computeSituationKey_BTN_SB_BB_FISH_FISH: vi.fn(() => "BTN_SB_BB_FISH_FISH"),
    pickBucketName: vi.fn((_min: number, _max: number) => "20_75_BB"),
  };
});

// ---- Mock del store legacy para que no toque localStorage/estado real ----
vi.mock("../strategy/store", () => {
  return {
    loadStrategyStore: vi.fn(async () => ({ version: 1, globals: {} })),
    saveStrategyStore: vi.fn(() => undefined),
    listSubs: vi.fn(() => []),
    upsertSub: vi.fn(() => 0),
    deleteSub: vi.fn(() => undefined),
    ensureGlobal: vi.fn(() => undefined),
  };
});

// Importar módulos después de mocks
import * as sql from "../db/sql";
import StrategyPage from "../pages/StrategyPage";

async function nextTick() {
  await new Promise((r) => setTimeout(r, 0));
}

describe("StrategyPage (UI) - Guardado SQLite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sql.initDB as any).mockResolvedValue(undefined);
    (sql.upsertSituationKey as any).mockResolvedValue(123);
    (sql.ensureBucketsForSituation as any).mockResolvedValue(undefined);
    (sql.upsertSubStrategy as any).mockResolvedValue(undefined);
    (sql.computeSituationKey_BTN_SB_BB_FISH_FISH as any).mockReturnValue("BTN_SB_BB_FISH_FISH");
    (sql.pickBucketName as any).mockReturnValue("20_75_BB");
  });

  it("al montar llama a initDB()", async () => {
    render(<StrategyPage />);
    await nextTick(); // evita warning act()
    expect(sql.initDB).toHaveBeenCalledTimes(1);
  });

  it("al pulsar Guardar subestrategia: upsert situation + ensure buckets + upsertSubStrategy", async () => {
    const user = userEvent.setup();
    render(<StrategyPage />);

    const btn = await screen.findByRole("button", { name: /guardar subestrategia/i });
    await user.click(btn);

    expect(sql.computeSituationKey_BTN_SB_BB_FISH_FISH).toHaveBeenCalledTimes(1);
    expect(sql.upsertSituationKey).toHaveBeenCalledWith("BTN_SB_BB_FISH_FISH");
    expect(sql.ensureBucketsForSituation).toHaveBeenCalledWith(123);

    expect(sql.pickBucketName).toHaveBeenCalledWith(0, 75);

    expect(sql.upsertSubStrategy).toHaveBeenCalledTimes(1);
    const args = (sql.upsertSubStrategy as any).mock.calls[0];
    expect(args[0]).toBe(123);
    expect(args[1]).toBe("20_75_BB");
    expect(args[3]).toBe(0);
    expect(args[4]).toBe(75);

    expect(await screen.findByText(/guardado en sqlite/i)).toBeTruthy();
  });

  it("si DB falla al guardar: no crashea, muestra DB Save ERROR en status", async () => {
    const user = userEvent.setup();
    (sql.upsertSubStrategy as any).mockRejectedValueOnce(new Error("boom"));

    render(<StrategyPage />);

    const btn = await screen.findByRole("button", { name: /guardar subestrategia/i });
    await user.click(btn);

    expect(await screen.findByText(/db save error/i)).toBeTruthy();
    expect(await screen.findByText(/boom/i)).toBeTruthy();
  });
});
