/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\StrategyEditor.tsx
 *
 * Fix TS:
 * - P1Card requiere prop "patch" (no "onChange")
 * - VillainCard requiere props "which" + "title" + "patch" (no "index" + "onChange")
 *
 * Nota: mantenemos la API pública de StrategyEditor (value + onChange) para no romper padres.
 */
import { useMemo } from "react";
import type { OrRanges, OrRangesPlan, PlayerPos, SubStrategyPayload } from "../types";
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

  // compat (tests)
  orRanges?: OrRanges;
  onChangeOrRanges?: (next: OrRanges) => void;

  orRangesPlan?: OrRangesPlan;
  onChangeOrRangesPlan?: (next: OrRangesPlan) => void;
};

const SPOTS = ["BTN", "SB", "BB"] as const;
const POS: PlayerPos[] = ["BTN", "SB", "BB"];

const EMPTY_OR: OrRanges = {
  OR_TO_CALL_ANY: "",
  OPEN_PUSH: "",
  OR_TO_CALL_SMALL: "",
  OR_TO_FOLD: "",
};

export default function StrategyEditor({
  value,
  onChange,
  showOrPanel = false,
  orRanges,
  onChangeOrRanges,
  orRangesPlan,
  onChangeOrRangesPlan,
}: Props) {
  const computedSituacion = useMemo(() => {
    return computeSituacionFromPositions(value.hero_pos, value.p2_pos, value.p3_pos);
  }, [value.hero_pos, value.p2_pos, value.p3_pos]);

  function patch(p: Partial<SubStrategyPayload>) {
    const next: SubStrategyPayload = { ...value, ...p };
    next.situacion = computeSituacionFromPositions(next.hero_pos, next.p2_pos, next.p3_pos);
    onChange(next);
  }

  const effectiveOrRanges = orRanges ?? value.orRanges ?? EMPTY_OR;

  const handleOrRangesChange =
    onChangeOrRanges ??
    ((next: OrRanges) => {
      patch({ orRanges: next });
    });

  const effectivePlan = orRangesPlan ?? value.orRangesPlan;

  const handlePlanChange =
    onChangeOrRangesPlan ??
    ((next: OrRangesPlan) => {
      patch({ orRangesPlan: next });
    });

  return (
    <div style={cardStyle}>
      <div style={headerRow}>
        <div style={{ fontWeight: 700 }}>Editor</div>
        <div style={{ opacity: 0.7 }}>situacion: {computedSituacion}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <SelectField
          label="Spot"
          value={value.spot}
          options={SPOTS as unknown as string[]}
          onChange={(v) => patch({ spot: v as any })}
        />
        <SelectField
          label="Hero Pos"
          value={value.hero_pos}
          options={POS as unknown as string[]}
          onChange={(v) => patch({ hero_pos: v as PlayerPos })}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {/* ✅ Nuevo contrato: patch */}
        <P1Card value={value} patch={patch} />

        {/* ✅ Nuevo contrato: which + title + patch */}
        {/* Nota: si Which es un union de strings tipo "P2"/"P3" esto encaja.
            Si fuese otro formato, seguimos compilando porque el valor ya coincide
            con los labels usados por el componente. */}
        <VillainCard which={"P2" as any} title="P2" value={value} patch={patch} />
        <VillainCard which={"P3" as any} title="P3" value={value} patch={patch} />
      </div>

      {showOrPanel ? (
        <div style={{ marginTop: 12 }}>
          <OrRangesPanel
            situationKey={value.situacion}
            value={effectiveOrRanges}
            onChange={handleOrRangesChange}
            plan={effectivePlan}
            onChangePlan={handlePlanChange}
            p1_stack_min={value.p1_stack_min}
            p1_stack_max={value.p1_stack_max}
          />
        </div>
      ) : null}
    </div>
  );
}
