/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\SpotsStrategyEditor.tsx
 */

import { useState, useEffect } from "react";
import { updateStrategyPayload } from "../db/spots";

import { defaultPayload } from "./spotsStrategyEditor/payload";
import { deepMerge } from "./spotsStrategyEditor/deepMerge";
import { ensureSpotsPayload } from "./spotsStrategyEditor/ensureSpotsPayload";
import { JsonModal } from "./spotsStrategyEditor/components/JsonModal";
import { PlayerSection } from "./spotsStrategyEditor/components/PlayerSection";
import { OrBlocksEditor } from "./spotsStrategyEditor/components/OrBlocksEditor";
import { NashChartPanel } from "./spotsStrategyEditor/components/NashChartPanel";

export default function SpotsStrategyEditor({ strategy }: any) {
  const [payload, setPayload] = useState<any>(defaultPayload);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!strategy) return;

    try {
      const parsed = strategy.payload_json ? JSON.parse(strategy.payload_json) : {};
      const merged = deepMerge(defaultPayload, parsed);
      setPayload(merged);
    } catch {
      setPayload(defaultPayload);
    }
  }, [strategy]);

  function update(path: string[], value: any) {
    const clone = JSON.parse(JSON.stringify(payload));
    let obj = clone;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;
    setPayload(clone);
  }

  // Para parches “grandes” (mode/nash/chart) sin pelear con paths
  function patchPayload(patch: any) {
    const next = deepMerge(payload, patch);
    setPayload(next);
  }

  async function save() {
    await updateStrategyPayload(strategy.id, ensureSpotsPayload(payload));
    alert("Saved");
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Strategy Editor</h2>

      <button onClick={() => setShowJson(true)}>View JSON</button>

      <NashChartPanel payload={payload} onPatchPayload={patchPayload} />

      <h3>Hero</h3>
      <select value={payload.hero_pos} onChange={(e) => update(["hero_pos"], e.target.value)}>
        <option>BTN</option>
        <option>SB</option>
        <option>BB</option>
      </select>

      <PlayerSection
        title="P1"
        fields={["bet_min", "bet_max", "st_min", "st_max", "se_min", "se_max"]}
        getValue={(k) => payload?.p1?.[k] ?? 0}
        onChangeNumber={(k, v) => update(["p1", k], v)}
      />

      <PlayerSection
        title="P2"
        fields={["bet_min", "bet_max", "st_min", "st_max"]}
        getValue={(k) => payload?.p2?.[k] ?? 0}
        onChangeNumber={(k, v) => update(["p2", k], v)}
        extra={
          <>
            <div>
              Pos
              <select
                value={payload?.p2?.pos ?? "SB"}
                onChange={(e) => update(["p2", "pos"], e.target.value)}
              >
                <option>SB</option>
                <option>BB</option>
                <option>BTN</option>
              </select>
            </div>
            <div>
              Tipo
              <select
                value={payload?.p2?.tipo ?? "unknown"}
                onChange={(e) => update(["p2", "tipo"], e.target.value)}
              >
                <option>unknown</option>
                <option>fish</option>
                <option>reg</option>
              </select>
            </div>
          </>
        }
      />

      <PlayerSection
        title="P3"
        fields={["bet_min", "bet_max", "st_min", "st_max"]}
        getValue={(k) => payload?.p3?.[k] ?? 0}
        onChangeNumber={(k, v) => update(["p3", k], v)}
        extra={
          <>
            <div>
              Pos
              <select
                value={payload?.p3?.pos ?? "BB"}
                onChange={(e) => update(["p3", "pos"], e.target.value)}
              >
                <option>SB</option>
                <option>BB</option>
                <option>BTN</option>
              </select>
            </div>
            <div>
              Tipo
              <select
                value={payload?.p3?.tipo ?? "unknown"}
                onChange={(e) => update(["p3", "tipo"], e.target.value)}
              >
                <option>unknown</option>
                <option>fish</option>
                <option>reg</option>
              </select>
            </div>
          </>
        }
      />

      <OrBlocksEditor payload={payload} onUpdate={update} />

      <button onClick={save}>Save Strategy</button>

      <JsonModal open={showJson} onClose={() => setShowJson(false)} payload={payload} />
    </div>
  );
}