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
import { extractLocalImagePath, formatTempoS } from "./handsUtils";

type Props = {
  rows: HandsObsRow[];
  currentIndex: number;
  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;
  onSelectIndex: (nextIndex: number) => void;
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

function stringifyValue(value: unknown, pretty = false): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    return String(value);
  }
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getStrategyPayload(obj: any): any | null {
  return obj?.strategy ?? obj?.ocr?.strategy ?? null;
}

function getStrategyFailureText(strategy: any): string {
  if (!strategy) return "";
  return (
    strategy?.error ??
    strategy?.err ??
    strategy?.reason ??
    strategy?.message ??
    (!strategy?.ok ? stringifyValue(strategy, true) : "")
  );
}

function collectStrategyDetails(strategy: any): Array<{ label: string; value: string }> {
  if (!strategy) return [];
  const entries: Array<{ label: string; raw: unknown }> = [
    { label: "requested_situacion", raw: strategy?.requested_situacion ?? strategy?.requested },
    { label: "matched_ids", raw: strategy?.matched_ids },
    { label: "top_nonmatch_reasons", raw: strategy?.top_nonmatch_reasons },
    { label: "situacion", raw: strategy?.situacion ?? strategy?.situation ?? strategy?.spot },
    { label: "move", raw: strategy?.move },
  ];
  return entries
    .filter((entry) => isPresent(entry.raw))
    .map((entry) => ({ label: entry.label, value: stringifyValue(entry.raw) }));
}

function collectLinkDetails(row: HandsObsRow | null, rowOcrJson: any): Array<{ label: string; value: string }> {
  if (!row) return [];

  const linkStatus =
    (row as any)?.link_status ??
    rowOcrJson?.link_status ??
    rowOcrJson?.link?.status ??
    rowOcrJson?.hand_link?.status ??
    "";
  const unlinkReason =
    (row as any)?.unlink_reason ??
    (row as any)?.link_reason ??
    (row as any)?.no_link_reason ??
    rowOcrJson?.unlink_reason ??
    rowOcrJson?.link_reason ??
    rowOcrJson?.link?.reason ??
    rowOcrJson?.hand_link?.reason ??
    "";
  const matchMethod =
    (row as any)?.match_method ??
    (row as any)?.ocr_match_method ??
    rowOcrJson?.match_method ??
    rowOcrJson?.link?.match_method ??
    rowOcrJson?.hand_link?.match_method ??
    "";
  const linked =
    Boolean(matchMethod) ||
    Boolean((row as any)?.linked_obs_id ?? (row as any)?.linked_hand_id ?? (row as any)?.hand_link_id) ||
    String(linkStatus).toLowerCase() === "linked";
  const capturedGamecode = String((row as any)?.captured_gamecode ?? "").trim();

  if (linked) return [];

  const details: Array<{ label: string; value: string }> = [];
  if (isPresent(linkStatus)) details.push({ label: "Estado enlace", value: stringifyValue(linkStatus) });
  if (isPresent(unlinkReason)) details.push({ label: "Motivo enlace", value: stringifyValue(unlinkReason) });
  if (!capturedGamecode) details.push({ label: "Game code", value: "captured_gamecode vacio" });
  return details;
}

function getLinkBlockSummary(details: Array<{ label: string; value: string }>): string {
  if (!details.length) return "";
  return details.some((detail) => detail.label === "Game code" && detail.value === "captured_gamecode vacio")
    ? "La observacion OCR no pudo enlazarse con una mano real."
    : "La fila no tiene enlace persistido.";
}

function FailureBlock({
  title,
  summary,
  details,
  rawText,
}: {
  title: string;
  summary?: string;
  details?: Array<{ label: string; value: string }>;
  rawText?: string;
}) {
  const hasDetails = (details?.length ?? 0) > 0;
  const hasRaw = Boolean(rawText && rawText.trim());
  if (!summary && !hasDetails && !hasRaw) return null;

  return (
    <div style={{ marginTop: 12, border: "1px solid #f0d7dc", borderRadius: 8, padding: 10, background: "#fff8f8" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#7d1f2e" }}>{title}</div>
      {summary ? <div style={{ marginTop: 6, fontSize: 12, color: "#7d1f2e" }}>{summary}</div> : null}
      {hasDetails ? (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {details!.map((detail) => (
            <div key={detail.label} style={{ fontSize: 12 }}>
              <b>{detail.label}:</b> <span style={{ wordBreak: "break-word" }}>{detail.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {hasRaw ? (
        <pre
          style={{
            marginTop: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 220,
            overflow: "auto",
            fontSize: 11,
            fontFamily: "Consolas, 'Courier New', monospace",
            background: "#fff",
            border: "1px solid #efd3d8",
            borderRadius: 6,
            padding: 8,
          }}
        >
          {rawText}
        </pre>
      ) : null}
    </div>
  );
}

export function ImagePreviewModal({ rows, currentIndex, canRunOne, onRunOneForImage, onSelectIndex, onClose }: Props) {
  const row = rows[currentIndex] ?? null;
  const path = row ? extractLocalImagePath(row) ?? "" : "";
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
  const rowStrategy = React.useMemo(() => getStrategyPayload(rowOcrJson), [rowOcrJson]);
  const rowOk = Boolean(rowStrategy?.ok ?? false);
  const rowStrategyErr = getStrategyFailureText(rowStrategy);
  const rowStrategyDetails = React.useMemo(() => collectStrategyDetails(rowStrategy), [rowStrategy]);
  const rowLinkDetails = React.useMemo(() => collectLinkDetails(row, rowOcrJson), [row, rowOcrJson]);

  const workerStrategy = React.useMemo(() => getStrategyPayload(runJson), [runJson]);
  const workerOk = Boolean(workerStrategy?.ok ?? runJson?.preflop?.preflop_ok ?? false);
  const workerStrategyErr = getStrategyFailureText(workerStrategy);
  const workerStrategyDetails = React.useMemo(() => collectStrategyDetails(workerStrategy), [workerStrategy]);

  const okChecked = runJson ? workerOk : rowOk;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < rows.length - 1;

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
    setRunOut("");
    setRunJson(null);
  }, [path, currentIndex]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canGoPrev) {
        e.preventDefault();
        onSelectIndex(currentIndex - 1);
      }
      if (e.key === "ArrowRight" && canGoNext) {
        e.preventDefault();
        onSelectIndex(currentIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canGoNext, canGoPrev, currentIndex, onClose, onSelectIndex]);

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
            <button
              onClick={() => onSelectIndex(currentIndex - 1)}
              disabled={!canGoPrev}
              style={{
                border: "1px solid #ddd",
                background: canGoPrev ? "#fff" : "#f1f1f1",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: canGoPrev ? "pointer" : "not-allowed",
              }}
            >
              Anterior
            </button>

            <div style={{ fontSize: 12, minWidth: 54, textAlign: "center", color: "#444" }}>
              {currentIndex + 1} / {rows.length}
            </div>

            <button
              onClick={() => onSelectIndex(currentIndex + 1)}
              disabled={!canGoNext}
              style={{
                border: "1px solid #ddd",
                background: canGoNext ? "#fff" : "#f1f1f1",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: canGoNext ? "pointer" : "not-allowed",
              }}
            >
              Siguiente
            </button>

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
              width: 460,
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
                {rowLinkDetails.length > 0 ? (
                  <FailureBlock
                    title="Motivo por el cual no se pudo relacionar"
                    summary={getLinkBlockSummary(rowLinkDetails)}
                    details={rowLinkDetails}
                  />
                ) : null}
                {!rowOk ? (
                  <FailureBlock
                    title="Motivo por el cual no hay match de estrategia"
                    summary="Error de estrategia almacenado en la fila OCR."
                    details={rowStrategyDetails}
                    rawText={rowStrategyErr}
                  />
                ) : null}
              </>
            ) : (
              <>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>Estado estrategia (1 hand)</div>
                <div style={{ marginTop: 6, fontSize: 12, color: workerOk ? "#0a7a2f" : "#b00020" }}>
                  {workerOk ? "OK" : workerStrategyErr ? workerStrategyErr : "NO OK"}
                </div>
                {!workerOk ? (
                  <FailureBlock
                    title="Motivo por el cual no hay match de estrategia (1 hand)"
                    summary="Resultado del reprocesado manual de esta imagen."
                    details={workerStrategyDetails}
                    rawText={workerStrategyErr}
                  />
                ) : null}
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
