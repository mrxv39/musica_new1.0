import { useMemo } from "react";
import type { SubStrategyPayload } from "../types";

type Props = {
  value: SubStrategyPayload;
};

export default function OrRangesPanel({ value }: Props) {
  const hint = useMemo(() => {
    return `OR Panel (placeholder) — situacion: ${value.situacion}`;
  }, [value.situacion]);

  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: 8, padding: 12, background: "#fff" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>OR Ranges</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>{hint}</div>
      <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
        (Aquí meteremos el grid/selector de rangos cuando me pases la lógica exacta de la UI vieja.)
      </div>
    </div>
  );
}
