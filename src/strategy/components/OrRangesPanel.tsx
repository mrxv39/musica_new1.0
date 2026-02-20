/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\OrRangesPanel.tsx
 *
 * Panel OR Ranges (UI pulida):
 * - + Añadir pill
 * - - Remove ghost button (estilo actual)
 * - inputs numéricos step 0.01
 */

import type { OrRanges, OrRangeKey } from "../types";
import { validatePokerRangeList } from "../pokerRange";

type Props = {
  situationKey: string;
  value: OrRanges;
  onChange: (next: OrRanges) => void;
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

const LABELS: Record<OrRangeKey, string> = {
  OR_TO_CALL_ANY: "OR to Call Any",
  OPEN_PUSH: "Open Push",
  OR_TO_CALL_SMALL: "OR to Call Small",
  OR_TO_FOLD: "OR to Fold",
};

export default function OrRangesPanel({ situationKey, value, onChange }: Props) {
  // Track errors for each input
  const errors: Partial<Record<OrRangeKey, string>> = {};
  (Object.keys(LABELS) as OrRangeKey[]).forEach((key) => {
    const v = value[key] || "";
    const res = validatePokerRangeList(v);
    if (!res.ok) errors[key] = res.error || "Inválido";
  });

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>OR Ranges — {situationKey}</div>
      <div style={{ display: "grid", gap: 14 }}>
        {(Object.keys(LABELS) as OrRangeKey[]).map((key) => (
          <div key={key} style={{ marginBottom: 2 }}>
            <label style={{ fontWeight: 500, fontSize: "0.98em" }}>{LABELS[key]}</label>
            <input
              type="text"
              value={value[key] || ""}
              onChange={e => {
                const next: OrRanges = { ...value, [key]: e.target.value };
                onChange(next);
              }}
              placeholder="AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"
              style={{ ...inputStyle, borderColor: errors[key] ? "#e66" : inputStyle.borderColor }}
              aria-invalid={!!errors[key]}
            />
            {errors[key] && (
              <div style={{ color: "#c00", fontSize: "0.92em", marginTop: 2 }}>{errors[key]}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
        *El contenido se guarda junto a la subestrategia. Solo rangos estrictos válidos.
      </div>
    </div>
  );
}
