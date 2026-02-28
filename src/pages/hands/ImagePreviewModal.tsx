/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\ImagePreviewModal.tsx
import React from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { HandsObsRow } from "../../db";
import {
  extractBetMax,
  extractBetMin,
  extractMove,
  extractP1Bet,
  extractSituacion,
  extractStackEfectivo,
  extractTempoS,
} from "../../db";
import { formatTempoS } from "./handsUtils";

type Props = {
  path: string;
  row: HandsObsRow | null;
  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;
  onClose: () => void;
};

function safeJson<T = any>(s?: string): T | null {
  try {
    return JSON.parse(s ?? "") as T;
  } catch {
    return null;
  }
}

function tryParseWorkerOutputToJson(output: string): any | null {
  const t = (output || "").trim();
  if (!t) return null;

  // Caso ideal: output es JSON puro
  try {
    return JSON.parse(t);
  } catch {
    // fallback: intenta última línea JSON
  }

  const lastBrace = t.lastIndexOf("{");
  if (lastBrace >= 0) {
    const maybe = t.slice(lastBrace).trim();
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }

  return null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #eee" }}>
      <div style={{ width: 120, fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

export function ImagePreviewModal({ path, row, canRunOne, onRunOneForImage, onClose }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [runOut, setRunOut] = React.useState<string>("");
  const [runJson, setRunJson] = React.useState<any | null>(null);

  const src = React.useMemo(() => {
    const p = (path || "").trim();
    if (!p) return "";
    try {
      return convertFileSrc(p);
    } catch {
      return "";
    }
  }, [path]);

  const rowOcrJson = React.useMemo(() => safeJson<any>((row as any)?.ocr_json), [row]);
  const rowOk = Boolean(rowOcrJson?.strategy?.ok ?? rowOcrJson?.ocr?.strategy?.ok ?? false);
  const rowStrategyErr =
    (rowOcrJson?.strategy?.error ?? rowOcrJson?.ocr?.strategy?.error ?? rowOcrJson?.strategy?.err ?? "") || "";

  const workerOk = Boolean(runJson?.strategy?.ok ?? runJson?.ocr?.strategy?.ok ?? runJson?.preflop?.preflop_ok ?? false);
  const workerStrategyErr =
    (runJson?.strategy?.error ?? runJson?.ocr?.strategy?.error ?? runJson?.strategy?.err ?? "") || "";

  const okChecked = runJson ? workerOk : rowOk;

  const onRun = async () => {
    if (!path) return;
    setBusy(true);
    setRunOut("");
    setRunJson(null);
    try {
      const out = await onRunOneForImage(path);
      setRunOut(out);
      setRunJson(tryParseWorkerOutputToJson(out));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!path) return null;

  // Valores “relevantes” desde la fila (DB)
  const hand = (row as any)?.hand_class || (row as any)?.mano_raw || "";
  const stackef = extractStackEfectivo((row as any)?.ocr_json);
  const p1bet = extractP1Bet((row as any)?.ocr_json);
  const p2bet = (row as any)?.p2bet ?? rowOcrJson?.ocr?.bets?.P2 ?? rowOcrJson?.bets?.P2 ?? null;
  const p3bet = (row as any)?.p3bet ?? rowOcrJson?.ocr?.bets?.P3 ?? rowOcrJson?.bets?.P3 ?? null;
  const betmin = extractBetMin((row as any)?.ocr_json);
  const betmax = extractBetMax((row as any)?.ocr_json);
  const move = extractMove((row as any)?.ocr_json);
  const situacion = extractSituacion((row as any)?.ocr_json);
  const tempo = formatTempoS(extractTempoS((row as any)?.ocr_json));

  const positions =
    rowOcrJson?.ocr?.posiciones?.p1 && rowOcrJson?.ocr?.posiciones?.p2 && rowOcrJson?.ocr?.posiciones?.p3
      ? `${rowOcrJson.ocr.posiciones.p1} / ${rowOcrJson.ocr.posiciones.p2} / ${rowOcrJson.ocr.posiciones.p3}`
      : "";

  const requestedSituacion =
    rowOcrJson?.strategy?.requested_situacion ??
    rowOcrJson?.ocr?.strategy?.requested_situacion ??
    rowOcrJson?.strategy?.requested ??
    "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "92vw",
          height: "92vh",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {path}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={okChecked} readOnly />
              ok
            </label>

            <button
              onClick={onRun}
              disabled={!canRunOne || busy}
              style={{
                border: "1px solid #ddd",
                background: busy ? "#f1f1f1" : "#fff",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: !canRunOne || busy ? "not-allowed" : "pointer",
              }}
              title="Analiza ESTA imagen (la del modal)"
            >
              1 hand
            </button>

            <button
              onClick={onClose}
              style={{
                border: "1px solid #ddd",
                background: "#f7f7f7",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Body: imagen izquierda + panel derecha */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, background: "#111" }}>
          {/* Imagen */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            {src ? (
              <img
                src={src}
                alt="preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  background: "#111",
                }}
                onError={(e) => {
                  console.error("img load error", e);
                }}
              />
            ) : (
              <div style={{ color: "#fff" }}>No se pudo convertir la ruta.</div>
            )}
          </div>

          {/* Panel */}
          <div
            style={{
              width: 420,
              maxWidth: "40vw",
              background: "#fff",
              borderLeft: "1px solid #eee",
              padding: 12,
              overflow: "auto",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Valores relevantes (DB)</div>

            <Field label="hand" value={hand || ""} />
            <Field label="stackef" value={stackef ?? ""} />
            <Field label="bets" value={`p1=${p1bet ?? ""} | p2=${p2bet ?? ""} | p3=${p3bet ?? ""}`} />
            <Field label="move" value={move || ""} />
            <Field label="betmin/max" value={`${betmin ?? ""} / ${betmax ?? ""}`} />
            <Field label="situacion" value={situacion || ""} />
            <Field label="req_situacion" value={requestedSituacion || ""} />
            <Field label="pos" value={positions || ""} />
            <Field label="tempo(s)" value={tempo || ""} />

            {!runJson ? (
              <>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>Estado estrategia (DB)</div>
                <div style={{ marginTop: 6, fontSize: 12, color: rowOk ? "#0a7a2f" : "#b00020" }}>
                  {rowOk ? "OK" : rowStrategyErr ? rowStrategyErr : "NO OK"}
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>Estado estrategia (1 hand)</div>
                <div style={{ marginTop: 6, fontSize: 12, color: workerOk ? "#0a7a2f" : "#b00020" }}>
                  {workerOk ? "OK" : workerStrategyErr ? workerStrategyErr : "NO OK"}
                </div>
              </>
            )}

            {runOut ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>
                  Ver salida completa (stdout/stderr)
                </summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8, background: "#fafafa", padding: 8, borderRadius: 8 }}>
                  {runOut}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
