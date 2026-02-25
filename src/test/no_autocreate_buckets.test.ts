// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\no_autocreate_buckets.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock DB layer used by dbSaveSub
vi.mock("../db/sql", () => {
  return {
    initDB: vi.fn(async () => {}),
    listAllSubStrategies: vi.fn(async () => []),
    pickBucketName: vi.fn(() => "20_75_BB"),
    upsertSituationKey: vi.fn(async () => 123),
    ensureBucketsForSituation: vi.fn(async () => {}),
    upsertSubStrategy: vi.fn(async () => {}),
    deleteSubStrategyById: vi.fn(async () => true),
  };
});

import { dbSaveSub } from "../pages/strategy/db";
import * as sql from "../db/sql";

describe("no autocreate buckets", () => {
  it("dbSaveSub() must NOT call ensureBucketsForSituation()", async () => {
    const item: any = {
      payload: {
        spot: "BTN",
        hero_pos: "BTN",
        p2_pos: "SB",
        p3_pos: "BB",
        p2_tipo: "fish",
        p3_tipo: "fish",
        p1_bet_min: 0,
        p1_bet_max: 1,
        p1_stack_min: 20,
        p1_stack_max: 75,
        p1_se_min: 0,
        p1_se_max: 1,
        p2_bet_min: 0,
        p2_bet_max: 1,
        p2_stack_min: 0,
        p2_stack_max: 1,
        p3_bet_min: 0,
        p3_bet_max: 1,
        p3_stack_min: 0,
        p3_stack_max: 1,
        situacion: "BTN_vs_SB_BB",
        orRanges: { OR_TO_CALL_ANY: "", OPEN_PUSH: "", OR_TO_CALL_SMALL: "", OR_TO_FOLD: "" },
      },
      or_ranges: { OR_TO_CALL_ANY: "", OPEN_PUSH: "", OR_TO_CALL_SMALL: "", OR_TO_FOLD: "" },
    };

    await dbSaveSub(item);

    expect((sql as any).ensureBucketsForSituation).not.toHaveBeenCalled();
    expect((sql as any).upsertSubStrategy).toHaveBeenCalledTimes(1);
  });
});