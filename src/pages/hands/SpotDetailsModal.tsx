import React from "react";
import type { SpotRow } from "../../db";
import { convertFileSrc as _convertFileSrc } from "@tauri-apps/api/core";
import { computeEffectiveStackBbFromSpot, extractSpotPositionsFromRawJson } from "./handsTableUtils";

type Props = {
  open: boolean;
  row: SpotRow | null;
  onClose: () => void;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const panelStyle: React.CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "90vh",
  background: "#fff",
  borderRadius: 8,
  border: "1px solid #ddd",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};
const headerStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "#f5f5f5",
  borderBottom: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontWeight: 600,
};
const bodyStyle: React.CSSProperties = {
  padding: 12,
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.35,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};
const sectionStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 10,
};
const codeStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 8,
  maxHeight: 240,
  overflow: "auto",
};
const closeBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  cursor: "pointer",
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  fontSize: 12,
};

function pretty(obj: unknown): string {
  try {
    if (obj == null) return "";
    if (typeof obj === "string") {
      if (!obj.trim()) return "";
      const parsed = JSON.parse(obj);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj ?? "");
  }
}

function renderKV(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 6 }}>
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

export function SpotDetailsModal({ open, row, onClose }: Props) {
  if (!open || !row) return null;

  let convertFileSrc: (p: string) => string = (p) => p;
  try {
    if (_convertFileSrc) convertFileSrc = _convertFileSrc as any;
  } catch {
    // running in tests or non-tauri env
  }

  const imagePath = (row as any).image_path as string | undefined;
  const imgSrc = imagePath ? convertFileSrc(imagePath) : "";
  const se = computeEffectiveStackBbFromSpot({
    stacks_json: (row as any).stacks_json,
    bets_json: (row as any).bets_json,
    raw_json: (row as any).raw_json,
  });
  const pos = extractSpotPositionsFromRawJson((row as any).raw_json);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>Spot #{row.id} — mesa {row.mesa}</div>
          <button onClick={onClose} style={closeBtnStyle} title="Cerrar">Cerrar</button>
        </div>
        <div style={bodyStyle}>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Resumen</div>
            {renderKV("ID", row.id)}
            {renderKV("Mesa", row.mesa)}
            {renderKV("Ts", String((row as any).ts ?? ""))}
            {renderKV("Time", row.time != null ? Number(row.time).toFixed(3) : "")}
            {renderKV("Strategy ID", String((row as any).strategy_id ?? ""))}
            {renderKV("Move", String((row as any).strategy_move ?? ""))}
            {renderKV("Bet min", String((row as any).strategy_bet_min ?? ""))}
            {renderKV("Bet max", String((row as any).strategy_bet_max ?? ""))}
            {renderKV("SE (bb)", se.se_bb != null ? se.se_bb.toFixed(2) : "")}
            {renderKV("Hero pos", pos?.hero_pos ?? "")}
            {renderKV("P2 pos", pos?.p2_pos ?? "")}
            {renderKV("P3 pos", pos?.p3_pos ?? "")}
            {renderKV("Created", String((row as any).created_at ?? ""))}
            {renderKV("Mano", (() => {
              const raw = (row as any).raw_json as string | undefined;
              try {
                const j = raw ? JSON.parse(raw) : null;
                const hc = j?.mano_result?.hand_class;
                const mr = j?.mano_result?.mano_raw;
                return hc || mr || "";
              } catch {
                return "";
              }
            })())}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Imagen</div>
            {imgSrc ? (
              <img src={imgSrc} alt="spot" style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid #eee" }} />
            ) : (
              <div style={{ opacity: 0.7 }}>Sin imagen</div>
            )}
            {imagePath ? <div style={{ marginTop: 6, opacity: 0.7 }}>{imagePath}</div> : null}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Stacks</div>
            <pre style={codeStyle}>{pretty((row as any).stacks_json)}</pre>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Bets</div>
            <pre style={codeStyle}>{pretty((row as any).bets_json)}</pre>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Names</div>
            <pre style={codeStyle}>{pretty((row as any).names_json)}</pre>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Raw JSON</div>
            <pre style={codeStyle}>{pretty((row as any).raw_json)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

