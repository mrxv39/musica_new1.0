/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\orRangesPanel\OrRangeRow.tsx
 */
import type React from "react";
import { useEffect, useState } from "react";
import type { OrMoveSelect } from "../../types";
import { inputStyle, selectStyle } from "./styles";

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #f1f1f1",
};

const labelCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const controlsCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const rangeStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e9e9e9",
  outline: "none",
  fontSize: "0.95em",
};

const errorStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#b91c1c",
  fontSize: 12,
};

type Props = {
  label: string;

  move: OrMoveSelect;
  moves: OrMoveSelect[];
  locked: boolean;
  onChangeMove: (m: OrMoveSelect) => void;

  betMin: number;
  betMax: number;
  onChangeBetMin: (v: string) => void;
  onChangeBetMax: (v: string) => void;
  onBlurNormalize: () => void;

  rangeText: string;
  onChangeRangeText: (t: string) => void;

  placeholder?: string;
  error?: string;
};

export default function OrRangeRow({
  label,
  move,
  moves,
  locked,
  onChangeMove,
  betMin,
  betMax,
  onChangeBetMin,
  onChangeBetMax,
  onBlurNormalize,
  rangeText,
  onChangeRangeText,
  placeholder,
  error,
}: Props) {
  // Draft local para UX, pero el test espera que se llame onChange al escribir.
  const [draft, setDraft] = useState<string>(rangeText ?? "");

  useEffect(() => {
    setDraft(rangeText ?? "");
  }, [rangeText]);

  return (
    <div style={rowStyle}>
      <div style={labelCol}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      </div>

      <div style={controlsCol}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            style={selectStyle}
            value={move}
            disabled={locked}
            onChange={(e) => onChangeMove(e.target.value as OrMoveSelect)}
            onBlur={onBlurNormalize}
          >
            {moves.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* bet min/max: editables y persistentes */}
          <input
            style={inputStyle}
            type="number"
            step={0.5}
            value={betMin}
            onChange={(e) => onChangeBetMin(e.target.value)}
            onBlur={onBlurNormalize}
          />
          <input
            style={inputStyle}
            type="number"
            step={0.5}
            value={betMax}
            onChange={(e) => onChangeBetMax(e.target.value)}
            onBlur={onBlurNormalize}
          />
        </div>

        <input
          style={rangeStyle}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            // ✅ importante para tests: persistir mientras se escribe
            onChangeRangeText(v);
          }}
          onBlur={() => {
            // ✅ normalización en blur (sin re-emitir para evitar doble llamada)
            onBlurNormalize();
          }}
          placeholder={placeholder}
        />

        {error ? <div style={errorStyle}>{error}</div> : null}
      </div>
    </div>
  );
}
