import { useMemo } from "react";
import type { OrMove, OrRangeRow } from "../types";

type Props = {
  situacion: string;
  rows: OrRangeRow[];
  onChange: (rows: OrRangeRow[]) => void;
};

function makeId() {
  return `or_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function clampNum(v: number, min = -999999, max = 999999) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function numFromInput(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const MOVES: OrMove[] = ["OR", "PUSH", "FOLD"];

export default function OrRangesPanel({ situacion, rows, onChange }: Props) {
  const title = useMemo(() => {
    return `OR Ranges — ${situacion}`;
  }, [situacion]);

  const addRow = () => {
    const next: OrRangeRow[] = [
      ...rows,
      {
        id: makeId(),
        range: "",
        move: "OR",
        value_min: 0,
        value_max: 0,
      },
    ];
    onChange(next);
  };

  const updateRow = (id: string, patch: Partial<OrRangeRow>) => {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const n: OrRangeRow = { ...r, ...patch } as any;
      // normaliza min/max
      const mn = clampNum(Number(n.value_min));
      const mx = clampNum(Number(n.value_max));
      n.value_min = Math.min(mn, mx);
      n.value_max = Math.max(mn, mx);
      return n;
    });
    onChange(next);
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <button
          type="button"
          onClick={addRow}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", background: "#fafafa" }}
        >
          + Añadir
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          No hay filas todavía. Añade una y pon el rango (ej: <code>ATs+</code>, <code>22-99</code>, <code>A5s-A2s</code>) y
          el move.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 88px 78px 78px 36px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={r.range}
                onChange={(e) => updateRow(r.id, { range: e.target.value })}
                placeholder="range"
                style={{ width: "100%" }}
              />

              <select
                value={r.move}
                onChange={(e) => updateRow(r.id, { move: e.target.value as OrMove })}
                style={{ width: "100%" }}
              >
                {MOVES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                value={r.value_min}
                onChange={(e) => updateRow(r.id, { value_min: clampNum(numFromInput(e.target.value)) })}
                placeholder="min"
                style={{ width: "100%" }}
              />

              <input
                value={r.value_max}
                onChange={(e) => updateRow(r.id, { value_max: clampNum(numFromInput(e.target.value)) })}
                placeholder="max"
                style={{ width: "100%" }}
              />

              <button
                type="button"
                onClick={() => removeRow(r.id)}
                title="Borrar"
                style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, marginTop: 12, opacity: 0.75 }}>
        *El contenido se guarda en SQLite junto a la subestrategia (auto-guardado cuando cambias inputs).
      </div>
    </div>
  );
}
