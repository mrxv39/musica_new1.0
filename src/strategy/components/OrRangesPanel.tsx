/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\OrRangesPanel.tsx
 *
 * Panel OR Ranges:
 * - Rangos strict (texto) + validación
 * - Por cada fila:
 *    - Move: OR/CALL/RAISE/FOLD/LIMP
 *    - Bet Min / Bet Max en BB (step 0.5)
 * Reglas:
 * - FOLD => 0/0 (bloqueado)
 * - LIMP => 1/1 (bloqueado)
 * - CALL => 0/0 (bloqueado)
 * - OR/RAISE => libre (step 0.5), se normaliza min<=max
 */
import type { OrRanges, OrRangeKey, OrRangesPlan, OrMoveSelect } from "../types";
import { validatePokerRangeList } from "../pokerRange";
import { coerceMinMax } from "../utils";

import { cardStyle } from "./orRangesPanel/styles";
import OrRangeRow from "./orRangesPanel/OrRangeRow";
import { LABELS, MOVES, applyMoveRules, ensurePlan, isLockedRow, safeNum } from "./orRangesPanel/model";

type Props = {
  situationKey: string;

  value: OrRanges;
  onChange: (next: OrRanges) => void;

  plan?: OrRangesPlan;
  onChangePlan?: (next: OrRangesPlan) => void;
};

export default function OrRangesPanel({ situationKey, value, onChange, plan, onChangePlan }: Props) {
  const effectivePlan = ensurePlan(plan);
  const planOnChange = onChangePlan ?? (() => {});

  // Track errors for each strict-range input
  const errors: Partial<Record<OrRangeKey, string>> = {};
  (Object.keys(LABELS) as OrRangeKey[]).forEach((key) => {
    const v = value[key] || "";
    const res = validatePokerRangeList(v);
    if (!res.ok) errors[key] = res.error || "Inválido";
  });

  function patchPlan(key: OrRangeKey, nextRow: OrRangesPlan[OrRangeKey]) {
    const next: OrRangesPlan = { ...effectivePlan, [key]: nextRow };
    planOnChange(next);
  }

  function normalizeMinMax(key: OrRangeKey) {
    const row = effectivePlan[key];

    if (row.move === "FOLD") return patchPlan(key, { ...row, bet_min_bb: 0, bet_max_bb: 0 });
    if (row.move === "LIMP") return patchPlan(key, { ...row, bet_min_bb: 1, bet_max_bb: 1 });
    if (row.move === "CALL") return patchPlan(key, { ...row, bet_min_bb: 0, bet_max_bb: 0 });

    const mm = coerceMinMax(row.bet_min_bb, row.bet_max_bb, { min: 0, max: 9999, step: 0.5 });
    patchPlan(key, { ...row, bet_min_bb: mm.min, bet_max_bb: mm.max });
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>OR Ranges — {situationKey}</div>

      <div style={{ display: "grid", gap: 14 }}>
        {(Object.keys(LABELS) as OrRangeKey[]).map((key) => {
          const row = effectivePlan[key];
          const locked = isLockedRow(row.move);

          return (
            <OrRangeRow
              key={key}
              label={LABELS[key]}
              move={row.move}
              moves={MOVES}
              locked={locked}
              onChangeMove={(m: OrMoveSelect) => {
                const nextRow = applyMoveRules(m, row);
                patchPlan(key, nextRow);
              }}
              betMin={row.bet_min_bb}
              betMax={row.bet_max_bb}
              onChangeBetMin={(v) => patchPlan(key, { ...row, bet_min_bb: safeNum(String(v)) })}
              onChangeBetMax={(v) => patchPlan(key, { ...row, bet_max_bb: safeNum(String(v)) })}
              onBlurNormalize={() => normalizeMinMax(key)}
              rangeText={value[key] || ""}
              onChangeRangeText={(t) => onChange({ ...value, [key]: t })}
              placeholder="AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"
              error={errors[key]}
            />
          );
        })}
      </div>

      <div style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
        *Rangos strict válidos. Bet Min/Max en BB (step 0.5). FOLD=0/0, LIMP=1/1, CALL=0/0.
      </div>
    </div>
  );
}
