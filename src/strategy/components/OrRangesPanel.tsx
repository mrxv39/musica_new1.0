/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\OrRangesPanel.tsx
 *
 * Panel OR Ranges (UI pulida):
 * - + Añadir pill
 * - - Remove ghost button (estilo actual)
 * - inputs numéricos step 0.01
 */
import type { OrMove, OrRangeRow } from "../types";

type Props = {
  situationKey: string;
  rows: OrRangeRow[];
  onChange: (rows: OrRangeRow[]) => void;
};

const MOVES: OrMove[] = ["OR", "PUSH", "FOLD"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

const pillBtn: React.CSSProperties = {
  border: "1px solid #e6e6e6",
  background: "#fff",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const ghostMinusBtn: React.CSSProperties = {
  border: "1px solid #eeeeee",
  background: "#fafafa",
  borderRadius: 8,
  width: 34,
  height: 30,
  lineHeight: "28px",
  textAlign: "center",
  cursor: "pointer",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #e9e9e9",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: 28,
};

export default function OrRangesPanel({ situationKey, rows, onChange }: Props) {
  const addRow = () => {
    const next: OrRangeRow[] = [
      ...(rows ?? []),
      { id: uid(), range: "ATs+", move: "OR", value_min: 0, value_max: 0 },
    ];
    onChange(next);
  };

  const patchRow = (id: string, p: Partial<OrRangeRow>) => {
    const next = (rows ?? []).map((r) => (r.id === id ? { ...r, ...p } : r));
    onChange(next);
  };

  const removeRow = (id: string) => {
    onChange((rows ?? []).filter((r) => r.id !== id));
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>OR Ranges — {situationKey}</div>
        <button type="button" onClick={addRow} style={pillBtn} aria-label="Añadir fila">
          + Añadir
        </button>
      </div>

      {(!rows || rows.length === 0) ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          No hay filas todavía. Añade una y pon el rango (ej: ATs+, 22-99, A5s-A2s) y el move.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 90px 90px 34px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={r.range}
                onChange={(e) => patchRow(r.id, { range: e.target.value })}
                placeholder="ATs+, 22-99..."
                style={inputStyle}
              />

              <select
                value={r.move}
                onChange={(e) => patchRow(r.id, { move: e.target.value as OrMove })}
                style={selectStyle}
              >
                {MOVES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <input
                type="number"
                step="0.01"
                value={r.value_min}
                onChange={(e) => patchRow(r.id, { value_min: Number(e.currentTarget.value || 0) })}
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                value={r.value_max}
                onChange={(e) => patchRow(r.id, { value_max: Number(e.currentTarget.value || 0) })}
                style={inputStyle}
              />

              <button
                type="button"
                onClick={() => removeRow(r.id)}
                style={ghostMinusBtn}
                aria-label="Eliminar fila"
                title="Eliminar"
              >
                −
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
        *El contenido se guarda junto a la subestrategia.
      </div>
    </div>
  );
}
