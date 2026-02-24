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

import type React from "react";
import type { OrRanges, OrRangeKey, OrRangesPlan, OrMoveSelect } from "../types";
import { validatePokerRangeList } from "../pokerRange";
import { coerceMinMax } from "../utils";

type Props = {
  situationKey: string;

  value: OrRanges;
  onChange: (next: OrRanges) => void;

  plan?: OrRangesPlan;
  onChangePlan?: (next: OrRangesPlan) => void;
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #e9e9e9",
  outline: "none",
  fontSize: "1em",
};

const smallNumberStyle: React.CSSProperties = {
  width: 92,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #e9e9e9",
  outline: "none",
  fontSize: "0.95em",
};

const selectStyle: React.CSSProperties = {
  width: 98,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #e9e9e9",
  outline: "none",
  fontSize: "0.95em",
  background: "white",
};

const LABELS: Record<OrRangeKey, string> = {
  OR_TO_CALL_ANY: "OR to Call Any",
  OPEN_PUSH: "Open Push",
  OR_TO_CALL_SMALL: "OR to Call Small",
  OR_TO_FOLD: "OR to Fold",
};

const MOVES: OrMoveSelect[] = ["OR", "CALL", "RAISE", "FOLD", "LIMP"];

function defaultPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_CALL_SMALL: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_FOLD: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
  };
}

function ensurePlan(p?: OrRangesPlan): OrRangesPlan {
  const base = defaultPlan();
  return { ...base, ...(p || {}) };
}

function safeNum(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

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

  function applyMoveRules(move: OrMoveSelect, row: OrRangesPlan[OrRangeKey]) {
    if (move === "FOLD") return { ...row, move, bet_min_bb: 0, bet_max_bb: 0 };
    if (move === "LIMP") return { ...row, move, bet_min_bb: 1, bet_max_bb: 1 };
    if (move === "CALL") return { ...row, move, bet_min_bb: 0, bet_max_bb: 0 };
    return { ...row, move };
  }

  function normalizeMinMax(key: OrRangeKey) {
    const row = effectivePlan[key];

    // reglas fijas
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
          const locked = row.move === "FOLD" || row.move === "LIMP" || row.move === "CALL";

          return (
            <div key={key} style={{ marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <label style={{ fontWeight: 500, fontSize: "0.98em" }}>{LABELS[key]}</label>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={row.move}
                    onChange={(e) => {
                      const nextMove = e.target.value as OrMoveSelect;
                      const nextRow = applyMoveRules(nextMove, row);
                      patchPlan(key, nextRow);
                    }}
                    style={selectStyle}
                    aria-label={`${LABELS[key]} move`}
                  >
                    {MOVES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step={0.5}
                    value={row.bet_min_bb}
                    disabled={locked}
                    onChange={(e) => {
                      const n = safeNum(e.target.value);
                      patchPlan(key, { ...row, bet_min_bb: n });
                    }}
                    onBlur={() => normalizeMinMax(key)}
                    style={{ ...smallNumberStyle, opacity: locked ? 0.6 : 1 }}
                    aria-label={`${LABELS[key]} bet min bb`}
                  />

                  <input
                    type="number"
                    step={0.5}
                    value={row.bet_max_bb}
                    disabled={locked}
                    onChange={(e) => {
                      const n = safeNum(e.target.value);
                      patchPlan(key, { ...row, bet_max_bb: n });
                    }}
                    onBlur={() => normalizeMinMax(key)}
                    style={{ ...smallNumberStyle, opacity: locked ? 0.6 : 1 }}
                    aria-label={`${LABELS[key]} bet max bb`}
                  />
                </div>
              </div>

              <input
                type="text"
                value={value[key] || ""}
                onChange={(e) => {
                  const next: OrRanges = { ...value, [key]: e.target.value };
                  onChange(next);
                }}
                placeholder="AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"
                style={{ ...inputStyle, borderColor: errors[key] ? "#e66" : inputStyle.borderColor, marginTop: 6 }}
                aria-invalid={!!errors[key]}
              />

              {errors[key] && <div style={{ color: "#c00", fontSize: "0.92em", marginTop: 2 }}>{errors[key]}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
        *Rangos strict válidos. Bet Min/Max en BB (step 0.5). FOLD=0/0, LIMP=1/1, CALL=0/0.
      </div>
    </div>
  );
}
