/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 */
import type { StrategyGlobal } from "../../strategy/constants";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { ensureGlobal } from "../../strategy/store";
import { makeSubId, normalizePayload } from "../../strategy/utils";

import {
  initDB,
  upsertSituationKey,
  ensureBucketsForSituation,
  upsertSubStrategy,
  computeSituationKey_BTN_SB_BB_FISH_FISH,
  pickBucketName,
  listSubStrategiesBySituationKey,
} from "../../db/sql";

function emptyStore(): StrategyStore {
  return { version: 1, globals: {} };
}

export async function dbInit(): Promise<void> {
  await initDB();
}

export async function dbLoadSubs(globalName: StrategyGlobal): Promise<StrategyStore> {
  const situationKey = computeSituationKey_BTN_SB_BB_FISH_FISH();
  const rows: any[] = await listSubStrategiesBySituationKey(situationKey);

  const items: SubStrategyItem[] = (rows || [])
    .map((r) => {
      try {
        const raw = JSON.parse(r.payload_json) as SubStrategyPayload;
        const p = normalizePayload(raw);
        // filtra basura vieja que venga incompleta
        if (!p.spot || !p.hero_pos || !p.p2_pos || !p.p3_pos) return null;
        return { id: makeSubId(p), payload: p } as SubStrategyItem;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as SubStrategyItem[];

  const next = emptyStore();
  ensureGlobal(next, globalName);
  next.globals[globalName].subs = items;
  return next;
}

export async function dbSaveSub(item: SubStrategyItem): Promise<{ situationKey: string; bucket: string }> {
  const p = normalizePayload(item.payload);

  const situationKey = computeSituationKey_BTN_SB_BB_FISH_FISH();
  const situationId = await upsertSituationKey(situationKey);
  await ensureBucketsForSituation(situationId);

  const bucket = pickBucketName(Number(p.p1_stack_min), Number(p.p1_stack_max));

  await upsertSubStrategy(
    situationId,
    bucket,
    p,
    Number(p.p1_stack_min),
    Number(p.p1_stack_max)
  );

  return { situationKey, bucket };
}
