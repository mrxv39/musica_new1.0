/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\OrRangesPanel.tsx
 */
import { useEffect } from "react";
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

  p1_stack_min: number;
  p1_stack_max: number;
};

export default function OrRangesPanel({
  situationKey,
  value,
  onChange,
  plan,
  onChangePlan,
  p1_stack_min,
  p1_stack_max,
}: Props) {
  const effectivePlan = ensurePlan(plan);
  const planOnChange = onChangePlan ?? (() => {});

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

  // OPEN_PUSH sigue derivado del stack P1
  useEffect(() => {
    const row = effectivePlan.OPEN_PUSH;
    const mustMove = row.move !== "OPEN_PUSH";
    const mustMin = row.bet_min_bb !== p1_stack_min;
    const mustMax = row.bet_max_bb !== p1_stack_max;
    if (mustMove || mustMin || mustMax) {
      patchPlan("OPEN_PUSH", {
        move: "OPEN_PUSH",
        bet_min_bb: p1_stack_min,
        bet_max_bb: p1_stack_max,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1_stack_min, p1_stack_max, plan]);

  function normalizeMinMax(key: OrRangeKey) {
    const row = effectivePlan[key];

    // OPEN_PUSH derivado: siempre fuerza valores
    if (key === "OPEN_PUSH") {
      return patchPlan(key, {
        move: "OPEN_PUSH",
        bet_min_bb: p1_stack_min,
        bet_max_bb: p1_stack_max,
      });
    }

    // Ahora: NO forzamos 0/0 o 1/1 por move.
    // Solo normalizamos min<=max y step.
    const mm = coerceMinMax(row.bet_min_bb, row.bet_max_bb, {
      min: 0,
      max: 9999,
      step: 0.5,
    });
    patchPlan(key, { ...row, bet_min_bb: mm.min, bet_max_bb: mm.max });
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>OR Ranges — {situationKey}</div>

      {(Object.keys(LABELS) as OrRangeKey[]).map((key) => {
        const row = effectivePlan[key];

        const isOpenPush = key === "OPEN_PUSH";
        const derivedRow = isOpenPush
          ? {
              move: "OPEN_PUSH" as OrMoveSelect,
              bet_min_bb: p1_stack_min,
              bet_max_bb: p1_stack_max,
            }
          : row;

        // Bloqueos por move desactivados (model.ts devuelve false).
        // OPEN_PUSH sigue bloqueado por diseño derivado.
        const locked = isOpenPush ? true : isLockedRow(derivedRow.move);

        return (
          <OrRangeRow
            key={key}
            label={LABELS[key]}
            move={derivedRow.move}
            moves={isOpenPush ? (["OPEN_PUSH"] as OrMoveSelect[]) : MOVES}
            locked={locked}
            onChangeMove={(m) => {
              if (isOpenPush) return;
              const nextRow = applyMoveRules(m, derivedRow as any);
              patchPlan(key, nextRow);
            }}
            betMin={derivedRow.bet_min_bb}
            betMax={derivedRow.bet_max_bb}
            onChangeBetMin={(v) => {
              if (isOpenPush) return;
              patchPlan(key, { ...(derivedRow as any), bet_min_bb: safeNum(String(v)) });
            }}
            onChangeBetMax={(v) => {
              if (isOpenPush) return;
              patchPlan(key, { ...(derivedRow as any), bet_max_bb: safeNum(String(v)) });
            }}
            onBlurNormalize={() => normalizeMinMax(key)}
            rangeText={value[key] || ""}
            onChangeRangeText={(t) => onChange({ ...value, [key]: t })}
            placeholder="AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"
            error={errors[key]}
          />
        );
      })}
    </div>
  );
}
