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
import { updatePlayerTipoByName, listPlayers, type PlayerRow } from "../../db/players";

type Props = {
  rows: HandsObsRow[];
  currentIndex: number;
  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;
  onSelectIndex: (nextIndex: number) => void;
  onClose: () => void;
  onMarkReview?: (obsId: number, status: "ok" | "error" | null) => Promise<void>;
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

function getStrategyDiagnosticSummary(scope: "db" | "worker"): string {
  const base =
    scope === "db"
      ? "Detalle del fallo de estrategia (no afecta al enlace OBSREAL)."
      : "Detalle del fallo de estrategia para esta imagen.";
  return `${base} Nota: estos errores describen la busqueda de rango/estrategia; el enlace OBSREAL se diagnostica en el bloque 'Motivo por el cual no se pudo relacionar'.`;
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

function InfoCard({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div
      style={{
        padding: "4px 10px",
        background: "rgba(0,0,0,0.75)",
        borderRadius: 6,
        textAlign: "center",
        minWidth: 60,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: large ? 18 : 14, fontWeight: 700, color: color || "#fff", marginTop: 1 }}>{value}</div>
    </div>
  );
}

function DraggableOverlay({
  storageKey,
  defaultX,
  defaultY,
  children,
}: {
  storageKey: string;
  defaultX: number;
  defaultY: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = React.useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch {}
    return { x: defaultX, y: defaultY };
  });
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y };
      setPos(next);
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setPos((p) => { localStorage.setItem(storageKey, JSON.stringify(p)); return p; });
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [storageKey]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: "absolute", left: pos.x, top: pos.y, cursor: "grab", pointerEvents: "auto", zIndex: 10 }}
    >
      {children}
    </div>
  );
}

function PlayerTipoOverlay({ label, name, tipo }: { label: string; name: string; tipo: string }) {
  const CYCLE = ["fish", "reg", "unknown"] as const;
  const initial = CYCLE.includes(tipo as any) ? tipo : "unknown";
  const [current, setCurrent] = React.useState(initial);
  React.useEffect(() => { setCurrent(CYCLE.includes(tipo as any) ? tipo : "unknown"); }, [tipo]);

  const handleToggle = async () => {
    if (!name) return;
    const idx = CYCLE.indexOf(current as any);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setCurrent(next);
    try {
      await updatePlayerTipoByName(name, next);
    } catch (e) {
      console.error("updatePlayerTipo failed", e);
    }
  };

  return (
    <div
      onClick={handleToggle}
      style={{
        background: current === "fish" ? "rgba(40,167,69,0.85)" : current === "reg" ? "rgba(220,53,69,0.85)" : "rgba(108,117,125,0.85)",
        borderRadius: 6,
        padding: "4px 10px",
        textAlign: "center",
        cursor: "pointer",
        minWidth: 50,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
        {current.toUpperCase()}
      </div>
    </div>
  );
}

const REVIEW_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  ok: { bg: "#d4edda", fg: "#155724", label: "OK" },
  error: { bg: "#f8d7da", fg: "#721c24", label: "ERROR" },
};

export function ImagePreviewModal({
  rows,
  currentIndex,
  canRunOne,
  onRunOneForImage,
  onSelectIndex,
  onClose,
  onMarkReview,
}: Props) {
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

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < rows.length - 1;

  const reviewStatus = (row as any)?.review_status ?? null;
  const obsId = (row as any)?.obs_id ?? (row as any)?.id ?? null;

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

  const handleMarkOk = async () => {
    if (!onMarkReview || obsId == null) return;
    await onMarkReview(obsId, "ok");
    if (canGoNext) onSelectIndex(currentIndex + 1);
  };

  const handleMarkError = async () => {
    if (!onMarkReview || obsId == null) return;
    await onMarkReview(obsId, "error");
  };

  const handleClearReview = async () => {
    if (!onMarkReview || obsId == null) return;
    await onMarkReview(obsId, null);
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
      // Space = mark OK + next
      if (e.key === " " && onMarkReview && obsId != null) {
        e.preventDefault();
        handleMarkOk();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canGoNext, canGoPrev, currentIndex, onClose, onSelectIndex, obsId, onMarkReview]);

  if (!path) return null;

  // Valores "relevantes" desde la fila (DB)
  const hand = (row as any)?.hand_class || (row as any)?.mano_raw || "";
  const stackef = (row as any)?.p1_se_bb ?? extractStackEfectivo((row as any)?.ocr_json);
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

  const p2Name = rowOcrJson?.ocr?.villano?.p2?.name || rowOcrJson?.ocr?.names?.p2_name || "";
  const p3Name = rowOcrJson?.ocr?.villano?.p3?.name || rowOcrJson?.ocr?.names?.p3_name || "";

  // Load tipo from players table (live, not snapshot)
  const [playersMap, setPlayersMap] = React.useState<Record<string, string>>({});
  const refreshPlayers = React.useCallback(() => {
    listPlayers().then((rows) => {
      const m: Record<string, string> = {};
      for (const r of rows) m[r.name] = r.tipo;
      setPlayersMap(m);
    }).catch(() => {});
  }, []);
  React.useEffect(() => { refreshPlayers(); }, [currentIndex, refreshPlayers]);
  const p2Tipo = playersMap[p2Name] || "unknown";
  const p3Tipo = playersMap[p3Name] || "unknown";

  const requestedSituacion =
    rowOcrJson?.strategy?.requested_situacion ??
    rowOcrJson?.ocr?.strategy?.requested_situacion ??
    rowOcrJson?.strategy?.requested ??
    "";

  const badge = reviewStatus ? REVIEW_BADGE[reviewStatus] : null;

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            {badge && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {badge.label}
              </span>
            )}
            <span style={{ fontSize: 12, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {path}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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

            <div style={{ width: 1, height: 24, background: "#ddd" }} />

            {onMarkReview && (
              <>
                <button
                  onClick={handleMarkOk}
                  title="Marcar OK y avanzar (Espacio)"
                  style={{
                    border: "1px solid #28a745",
                    background: reviewStatus === "ok" ? "#28a745" : "#fff",
                    color: reviewStatus === "ok" ? "#fff" : "#28a745",
                    borderRadius: 8,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  OK
                </button>
                <button
                  onClick={handleMarkError}
                  title="Marcar como error"
                  style={{
                    border: "1px solid #dc3545",
                    background: reviewStatus === "error" ? "#dc3545" : "#fff",
                    color: reviewStatus === "error" ? "#fff" : "#dc3545",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Error
                </button>
                {reviewStatus && (
                  <button
                    onClick={handleClearReview}
                    title="Limpiar estado de review"
                    style={{
                      border: "1px solid #999",
                      background: "#fff",
                      color: "#666",
                      borderRadius: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </>
            )}

            <div style={{ width: 1, height: 24, background: "#ddd" }} />

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
          {/* Imagen — tamaño original con overlay cards */}
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 12, position: "relative" }}>
            {src ? (
              <>
                <img
                  src={src}
                  alt="preview"
                  style={{ background: "#111" }}
                  onError={(e) => {
                    console.error("img load error", e);
                  }}
                />
                {/* Overlay info cards — next to hero cards / time area */}
                <div
                  style={{
                    position: "absolute",
                    top: "58%",
                    left: "calc(66% - 160px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    pointerEvents: "none",
                  }}
                >
                  <InfoCard label="MOVE" value={move || "--"} color={move === "FOLD" ? "#ff4444" : move === "PUSH" ? "#44cc44" : move === "OR" ? "#44aaff" : "#fff"} />
                  <InfoCard label="BET" value={betmin != null && betmax != null ? `${betmin} / ${betmax}` : "--"} />
                  <InfoCard label="HAND" value={hand || "--"} large />
                  <InfoCard label="SE" value={stackef != null ? String(stackef) : "--"} />
                </div>
                <DraggableOverlay storageKey="overlay_p2_pos" defaultX={10} defaultY={100}>
                  <PlayerTipoOverlay label="P2" name={p2Name} tipo={p2Tipo} />
                </DraggableOverlay>
                <DraggableOverlay storageKey="overlay_p3_pos" defaultX={600} defaultY={100}>
                  <PlayerTipoOverlay label="P3" name={p3Name} tipo={p3Tipo} />
                </DraggableOverlay>
              </>
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
                    title="Diagnostico de estrategia (rangos preflop)"
                    summary={getStrategyDiagnosticSummary("db")}
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
                    title="Diagnostico de estrategia (1 hand)"
                    summary={getStrategyDiagnosticSummary("worker")}
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
