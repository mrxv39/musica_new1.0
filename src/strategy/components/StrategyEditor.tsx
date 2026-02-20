import { useMemo } from "react";
import type { SubStrategyPayload, PlayerPos, PlayerTipo } from "../types";
import { computeSituacionFromPositions } from "../utils";
import OrRangesPanel from "./OrRangesPanel";

type Props = {
  value: SubStrategyPayload;
  onChange: (next: SubStrategyPayload) => void;
  showOrPanel?: boolean;
};

function clampNum(v: number, min = 0, max = 9999) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function numFromInput(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const POS: PlayerPos[] = ["BTN", "SB", "BB"];
const TIPOS: PlayerTipo[] = ["fish", "reg", "unknown"];

export default function StrategyEditor({ value, onChange, showOrPanel = false }: Props) {
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
      <div style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: 14, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Editor</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>situacion: {computedSituacion}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            Spot
            <select
              value={value.spot}
              onChange={(e) => patch({ spot: e.target.value as any })}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="BTN">BTN</option>
              <option value="SB">SB</option>
              <option value="BB">BB</option>
            </select>
          </label>

          <label style={{ fontSize: 12 }}>
            Hero pos
            <select
              value={value.hero_pos}
              onChange={(e) => patch({ hero_pos: e.target.value as PlayerPos })}
              style={{ width: "100%", marginTop: 4 }}
            >
              {POS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div />
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "14px 0" }} />

        <div style={{ fontWeight: 600, marginBottom: 8 }}>P1 (hero env)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            bet min
            <input
              value={value.p1_bet_min}
              onChange={(e) => patch({ p1_bet_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            bet max
            <input
              value={value.p1_bet_max}
              onChange={(e) => patch({ p1_bet_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            st min
            <input
              value={value.p1_stack_min}
              onChange={(e) => patch({ p1_stack_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            st max
            <input
              value={value.p1_stack_max}
              onChange={(e) => patch({ p1_stack_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            SE min
            <input
              value={value.p1_se_min}
              onChange={(e) => patch({ p1_se_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            SE max
            <input
              value={value.p1_se_max}
              onChange={(e) => patch({ p1_se_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "14px 0" }} />

        <div style={{ fontWeight: 600, marginBottom: 8 }}>P2 / P3</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            P2 pos
            <select
              value={value.p2_pos}
              onChange={(e) => patch({ p2_pos: e.target.value as PlayerPos })}
              style={{ width: "100%", marginTop: 4 }}
            >
              {POS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12 }}>
            P2 tipo
            <select
              value={value.p2_tipo}
              onChange={(e) => patch({ p2_tipo: e.target.value as PlayerTipo })}
              style={{ width: "100%", marginTop: 4 }}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12 }}>
            P2 bet min
            <input
              value={value.p2_bet_min}
              onChange={(e) => patch({ p2_bet_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P2 bet max
            <input
              value={value.p2_bet_max}
              onChange={(e) => patch({ p2_bet_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P2 st min
            <input
              value={value.p2_stack_min}
              onChange={(e) => patch({ p2_stack_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P2 st max
            <input
              value={value.p2_stack_max}
              onChange={(e) => patch({ p2_stack_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          <div />
          <div />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
          <label style={{ fontSize: 12 }}>
            P3 pos
            <select
              value={value.p3_pos}
              onChange={(e) => patch({ p3_pos: e.target.value as PlayerPos })}
              style={{ width: "100%", marginTop: 4 }}
            >
              {POS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12 }}>
            P3 tipo
            <select
              value={value.p3_tipo}
              onChange={(e) => patch({ p3_tipo: e.target.value as PlayerTipo })}
              style={{ width: "100%", marginTop: 4 }}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12 }}>
            P3 bet min
            <input
              value={value.p3_bet_min}
              onChange={(e) => patch({ p3_bet_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P3 bet max
            <input
              value={value.p3_bet_max}
              onChange={(e) => patch({ p3_bet_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P3 st min
            <input
              value={value.p3_stack_min}
              onChange={(e) => patch({ p3_stack_min: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            P3 st max
            <input
              value={value.p3_stack_max}
              onChange={(e) => patch({ p3_stack_max: clampNum(numFromInput(e.target.value)) })}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          <div />
          <div />
        </div>
      </div>

      {showOrPanel ? <OrRangesPanel value={value} /> : null}
    </div>
  );
}