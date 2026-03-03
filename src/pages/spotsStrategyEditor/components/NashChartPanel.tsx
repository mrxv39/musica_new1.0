/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\components\NashChartPanel.tsx
 */

import { useMemo, useState } from "react";

function safeStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export function NashChartPanel({
  payload,
  onPatchPayload,
}: {
  payload: any;
  onPatchPayload: (patch: any) => void;
}) {
  const currentChart = payload?.nash?.chart ?? {};
  const [text, setText] = useState<string>(() => safeStringify(currentChart));
  const [msg, setMsg] = useState<string>("");

  const isNash = payload?.mode === "NASH_PUSHFOLD";

  const stats = useMemo(() => {
    const keys = currentChart && typeof currentChart === "object" ? Object.keys(currentChart) : [];
    return { hands: keys.length };
  }, [currentChart]);

  function setModeNash() {
    onPatchPayload({
      mode: "NASH_PUSHFOLD",
      nash: { chart: currentChart && typeof currentChart === "object" ? currentChart : {} },
    });
    setMsg("Modo NASH activado (mode=NASH_PUSHFOLD).");
  }

  function exportToTextarea() {
    setText(safeStringify(currentChart));
    setMsg("Exportado a textarea.");
  }

  function importFromTextarea() {
    setMsg("");
    let parsed: any;
    try {
      parsed = JSON.parse(text || "{}");
    } catch {
      setMsg("❌ JSON inválido. Corrige el formato.");
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setMsg("❌ El chart debe ser un objeto: { \"AA\": 15, \"76s\": \"11-5\", ... }");
      return;
    }

    // Validación mínima: keys strings no vacías
    for (const k of Object.keys(parsed)) {
      const kk = String(k ?? "").trim();
      if (!kk) {
        setMsg("❌ Hay una key vacía en el chart.");
        return;
      }
    }

    onPatchPayload({
      mode: "NASH_PUSHFOLD",
      nash: { chart: parsed },
    });

    setMsg(`✅ Importado. Hands: ${Object.keys(parsed).length}. Guardar persistirá en payload_json.`);
  }

  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
      <h3>NASH Push/Fold</h3>

      <div style={{ fontSize: 12, opacity: 0.9 }}>
        Estado: <strong>{isNash ? "NASH_PUSHFOLD" : "normal"}</strong> · Hands en chart:{" "}
        <strong>{stats.hands}</strong>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={setModeNash}>Activar modo NASH</button>
        <button onClick={exportToTextarea}>Exportar chart</button>
        <button onClick={importFromTextarea}>Importar JSON → payload.nash.chart</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          Pega aquí el JSON del chart (ej: {"{"}"AA":15,"76s":"11-5"{"}"}):
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
        />
      </div>

      {msg && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
        Convención: pares "AA"; suited "AKs" (arriba diagonal); offsuit "AKo" (abajo diagonal).<br />
        Valores: 15 ⇒ push 0..15bb ; "11-5" ⇒ push 5..11bb ; sin entrada ⇒ fold.
      </div>
    </div>
  );
}