/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\orRangesPanel\OrRangeRow.tsx
 */
import type { OrMoveSelect } from "../../types";
import { inputStyle, selectStyle, smallNumberStyle } from "./styles";

type Props = {
  label: string;

  // move
  move: OrMoveSelect;
  moves: OrMoveSelect[];
  locked: boolean;
  onChangeMove: (next: OrMoveSelect) => void;

  // bet min/max
  betMin: number;
  betMax: number;
  onChangeBetMin: (next: number) => void;
  onChangeBetMax: (next: number) => void;
  onBlurNormalize: () => void;

  // strict range (text)
  rangeText: string;
  onChangeRangeText: (next: string) => void;
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
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <label style={{ fontWeight: 500, fontSize: "0.98em" }}>{label}</label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={move}
            onChange={(e) => onChangeMove(e.target.value as OrMoveSelect)}
            style={selectStyle}
            aria-label={`${label} move`}
          >
            {moves.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="number"
            step={0.5}
            value={betMin}
            disabled={locked}
            onChange={(e) => onChangeBetMin(Number(e.target.value))}
            onBlur={onBlurNormalize}
            style={{ ...smallNumberStyle, opacity: locked ? 0.6 : 1 }}
            aria-label={`${label} bet min bb`}
          />

          <input
            type="number"
            step={0.5}
            value={betMax}
            disabled={locked}
            onChange={(e) => onChangeBetMax(Number(e.target.value))}
            onBlur={onBlurNormalize}
            style={{ ...smallNumberStyle, opacity: locked ? 0.6 : 1 }}
            aria-label={`${label} bet max bb`}
          />
        </div>
      </div>

      <input
        type="text"
        value={rangeText}
        onChange={(e) => onChangeRangeText(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, borderColor: error ? "#e66" : inputStyle.borderColor, marginTop: 6 }}
        aria-invalid={!!error}
      />

      {error ? <div style={{ color: "#c00", fontSize: "0.92em", marginTop: 2 }}>{error}</div> : null}
    </div>
  );
}
