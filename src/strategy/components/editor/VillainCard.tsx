/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\editor\VillainCard.tsx
 */
import type { PlayerPos, PlayerTipo, SubStrategyPayload } from "../../types";
import { NumberField, SelectField } from "./EditorFields";
import { grid2, sectionTitle, subCardStyle } from "./editorStyles";

const POS: PlayerPos[] = ["BTN", "SB", "BB"];
const TIPOS: PlayerTipo[] = ["fish", "reg", "unknown"];

type Which = "p2" | "p3";

type PosKey = "p2_pos" | "p3_pos";
type TipoKey = "p2_tipo" | "p3_tipo";
type BetMinKey = "p2_bet_min" | "p3_bet_min";
type BetMaxKey = "p2_bet_max" | "p3_bet_max";
type StMinKey = "p2_stack_min" | "p3_stack_min";
type StMaxKey = "p2_stack_max" | "p3_stack_max";

function keysFor(which: Which): {
  posKey: PosKey;
  tipoKey: TipoKey;
  betMinKey: BetMinKey;
  betMaxKey: BetMaxKey;
  stMinKey: StMinKey;
  stMaxKey: StMaxKey;
} {
  if (which === "p2") {
    return {
      posKey: "p2_pos",
      tipoKey: "p2_tipo",
      betMinKey: "p2_bet_min",
      betMaxKey: "p2_bet_max",
      stMinKey: "p2_stack_min",
      stMaxKey: "p2_stack_max",
    };
  }
  return {
    posKey: "p3_pos",
    tipoKey: "p3_tipo",
    betMinKey: "p3_bet_min",
    betMaxKey: "p3_bet_max",
    stMinKey: "p3_stack_min",
    stMaxKey: "p3_stack_max",
  };
}

export default function VillainCard(props: {
  which: Which;
  title: string;
  value: SubStrategyPayload;
  patch: (p: Partial<SubStrategyPayload>) => void;
}) {
  const { which, title, value, patch } = props;
  const { posKey, tipoKey, betMinKey, betMaxKey, stMinKey, stMaxKey } = keysFor(which);

  return (
    <div style={subCardStyle}>
      <div style={sectionTitle}>{title}</div>

      <div style={grid2}>
        <SelectField
          label="pos"
          value={value[posKey] as PlayerPos}
          options={POS}
          onChange={(v) => patch({ [posKey]: v } as any)}
        />
        <SelectField
          label="tipo"
          value={value[tipoKey] as PlayerTipo}
          options={TIPOS}
          onChange={(v) => patch({ [tipoKey]: v } as any)}
        />
      </div>

      <div style={{ ...grid2, marginTop: 10 }}>
        <NumberField
          label="bet min"
          value={value[betMinKey] as number}
          onChange={(v) => patch({ [betMinKey]: v } as any)}
        />
        <NumberField
          label="bet max"
          value={value[betMaxKey] as number}
          onChange={(v) => patch({ [betMaxKey]: v } as any)}
        />

        <NumberField
          label="st min"
          value={value[stMinKey] as number}
          onChange={(v) => patch({ [stMinKey]: v } as any)}
        />
        <NumberField
          label="st max"
          value={value[stMaxKey] as number}
          onChange={(v) => patch({ [stMaxKey]: v } as any)}
        />
      </div>
    </div>
  );
}
