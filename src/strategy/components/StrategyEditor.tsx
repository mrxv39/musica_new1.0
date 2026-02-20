/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\StrategyEditor.tsx
 *
 * Cambios:
 * - Hero pos debajo de Spot
 * - P2 debajo de P1, P3 debajo de P2
 */
import { useMemo } from "react";
import type { OrRanges, PlayerPos, SubStrategyPayload } from "../types";
import { computeSituacionFromPositions } from "../utils";
import OrRangesPanel from "./OrRangesPanel";

import { SelectField } from "./editor/EditorFields";
import { cardStyle, headerRow } from "./editor/editorStyles";
import P1Card from "./editor/P1Card";
import VillainCard from "./editor/VillainCard";

type Props = {
  value: SubStrategyPayload;
  onChange: (next: SubStrategyPayload) => void;
  showOrPanel?: boolean;

  orRanges?: OrRanges;
  onChangeOrRanges?: (next: OrRanges) => void;
};

const SPOTS = ["BTN", "SB", "BB"] as const;
const POS: PlayerPos[] = ["BTN", "SB", "BB"];

export default function StrategyEditor({
  value,
  onChange,
  showOrPanel = false,
  orRanges,
  onChangeOrRanges,
}: Props) {
  const computedSituacion = useMemo(() => {
    return computeSituacionFromPositions(value.hero_pos, value.p2_pos, value.p3_pos);
  }, [value.hero_pos, value.p2_pos, value.p3_pos]);

  function patch(p: Partial<SubStrategyPayload>) {
    const next = { ...value, ...p };
    next.situacion = computeSituacionFromPositions(next.hero_pos, next.p2_pos, next.p3_pos);
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: showOrPanel ? "1fr 360px" : "1fr", gap: 14 }}>
      <div style={cardStyle}>
        <div style={headerRow}>
          <div style={{ fontWeight: 700 }}>Editor</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>situacion: {computedSituacion}</div>
        </div>

        {/* Top (Spot arriba, Hero pos debajo) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px)", gap: 10 }}>
          <SelectField
            label="Spot"
            value={value.spot as (typeof SPOTS)[number]}
            options={SPOTS}
            onChange={(v) => patch({ spot: v as any })}
          />

          <SelectField
            label="Hero pos"
            value={value.hero_pos}
            options={POS}
            onChange={(v) => patch({ hero_pos: v as PlayerPos })}
          />
        </div>

        {/* Cards apiladas: P1 -> P2 -> P3 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
          <P1Card value={value} patch={patch} />
          <VillainCard which="p2" title="P2" value={value} patch={patch} />
          <VillainCard which="p3" title="P3" value={value} patch={patch} />
        </div>
      </div>

      {showOrPanel ? (
        <OrRangesPanel
          situationKey={computedSituacion}
          value={orRanges ?? { OR_TO_CALL_ANY: "", OPEN_PUSH: "", OR_TO_CALL_SMALL: "", OR_TO_FOLD: "" }}
          onChange={onChangeOrRanges ?? (() => {})}
        />
      ) : null}
    </div>
  );
}
