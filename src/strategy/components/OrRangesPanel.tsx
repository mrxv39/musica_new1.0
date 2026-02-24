/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\OrRangesPanel.tsx
 *
 * Compat layer:
 * - API (tests / StrategyPage): { situationKey, orRanges: OrRangeRow[], onChangeOrRanges }
 * - API (StrategyEditor):      { situationKey, value: OrRanges, onChange }
 *
 * We render rows always, and when a row changes:
 * - if onChangeOrRanges exists -> emit next rows
 * - if onChange exists         -> emit next flat OrRanges
 */

import { cardStyle } from "./orRangesPanel/styles";
import OrRangeRowComponent from "./orRangesPanel/OrRangeRow";
import { LABELS, MOVES } from "./orRangesPanel/model";
import type { OrRangeRow, OrRanges } from "../types";

export type OrRangeRowState = OrRangeRow;

type PropsCompat = {
  situationKey: string;

  // ---- API A (tests / StrategyPage)
  orRanges?: OrRangeRowState[];
  onChangeOrRanges?: (next: OrRangeRowState[]) => void;

  // ---- API B (StrategyEditor)
  value?: OrRanges;
  onChange?: (next: OrRanges) => void;

  // extra props from StrategyEditor (ignored but allowed)
  plan?: any;
  onChangePlan?: any;
  p1_stack_min?: any;
  p1_stack_max?: any;
};

const OR_KEYS = ["OR_TO_CALL_ANY", "OPEN_PUSH", "OR_TO_CALL_SMALL", "OR_TO_FOLD"] as const;

function defaultRowsFromFlat(or?: OrRanges): OrRangeRowState[] {
  const base = (or ?? {}) as any;
  return OR_KEYS.map((k) => ({
    id: k,
    label: LABELS[k],
    mode: "OR",
    bet_min: 0,
    bet_max: 0,
    range: typeof base[k] === "string" ? base[k] : "",
  })) as any;
}

function rowsToFlat(rows: OrRangeRowState[]): OrRanges {
  const out: any = {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };

  for (const r of rows || []) {
    if (!r) continue;
    const id = (r as any).id;
    if (typeof id !== "string") continue;
    if ((out as any)[id] === undefined) continue;
    out[id] = typeof (r as any).range === "string" ? (r as any).range : String((r as any).range ?? "");
  }
  return out as OrRanges;
}

export default function OrRangesPanel(props: PropsCompat) {
  const { situationKey } = props;

  const hasRows = Array.isArray(props.orRanges) && props.orRanges.length > 0;
  const rows: OrRangeRowState[] = hasRows ? (props.orRanges as OrRangeRowState[]) : defaultRowsFromFlat(props.value);

  function emit(nextRows: OrRangeRowState[]) {
    // API A
    if (typeof props.onChangeOrRanges === "function") {
      props.onChangeOrRanges(nextRows);
    }
    // API B
    if (typeof props.onChange === "function") {
      props.onChange(rowsToFlat(nextRows));
    }
  }

  function handleRowChange(idx: number, patch: Partial<OrRangeRowState>) {
    const nextRows = rows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    emit(nextRows);
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>OR Ranges — {situationKey}</div>

      {rows.map((row, idx) => (
        <OrRangeRowComponent
          key={row.id}
          label={row.label || (LABELS as any)[row.id] || String(row.id)}
          move={row.mode as any}
          moves={MOVES}
          locked={false}
          onChangeMove={(m) => handleRowChange(idx, { mode: m as any })}
          betMin={Number.isFinite(row.bet_min as any) ? Number(row.bet_min) : 0}
          betMax={Number.isFinite(row.bet_max as any) ? Number(row.bet_max) : 0}
          onChangeBetMin={(v) => handleRowChange(idx, { bet_min: Number(v) })}
          onChangeBetMax={(v) => handleRowChange(idx, { bet_max: Number(v) })}
          onBlurNormalize={() => {}}
          rangeText={typeof row.range === "string" ? row.range : String((row as any).range ?? "")}
          onChangeRangeText={(t) => handleRowChange(idx, { range: t })}
          placeholder={"AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"}
          error={undefined}
        />
      ))}
    </div>
  );
}
