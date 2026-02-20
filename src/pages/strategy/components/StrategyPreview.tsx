/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategyPreview.tsx
 */
import { useMemo } from "react";
import type { SubStrategyPayload } from "../../../strategy/types";

export default function StrategyPreview({ payload }: { payload: SubStrategyPayload }) {
  const text = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: 8, padding: 12, background: "#fff" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
      <textarea value={text} readOnly style={{ width: "100%", height: 260, fontFamily: "monospace" }} />
    </div>
  );
}
