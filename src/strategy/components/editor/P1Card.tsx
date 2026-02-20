/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\editor\P1Card.tsx
 */
import type { SubStrategyPayload } from "../../types";
import { NumberField } from "./EditorFields";
import { grid2, sectionTitle, subCardStyle } from "./editorStyles";

export default function P1Card(props: {
  value: SubStrategyPayload;
  patch: (p: Partial<SubStrategyPayload>) => void;
}) {
  const { value, patch } = props;

  return (
    <div style={subCardStyle}>
      <div style={sectionTitle}>P1 (hero env)</div>

      <div style={grid2}>
        <NumberField label="bet min" value={value.p1_bet_min} onChange={(v) => patch({ p1_bet_min: v })} />
        <NumberField label="bet max" value={value.p1_bet_max} onChange={(v) => patch({ p1_bet_max: v })} />

        <NumberField label="st min" value={value.p1_stack_min} onChange={(v) => patch({ p1_stack_min: v })} />
        <NumberField label="st max" value={value.p1_stack_max} onChange={(v) => patch({ p1_stack_max: v })} />

        <NumberField label="SE min" value={value.p1_se_min} onChange={(v) => patch({ p1_se_min: v })} />
        <NumberField label="SE max" value={value.p1_se_max} onChange={(v) => patch({ p1_se_max: v })} />
      </div>
    </div>
  );
}
