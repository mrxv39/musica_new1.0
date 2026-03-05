/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\RealHandModal.tsx
import React from "react";
import type { ActionRealRow, HandRealRow } from "../../db";
import { fetchActionsRealForHand } from "../../db";

function streetLabel(roundNo: number) {
  if (roundNo === 1) return "PREFLOP";
  if (roundNo === 2) return "FLOP";
  if (roundNo === 3) return "TURN";
  if (roundNo === 4) return "RIVER";
  return "ROUND " + String(roundNo);
}

function suitLower(s: string) {
  const u = (s || "").toUpperCase();
  if (u === "C") return "c";
  if (u === "D") return "d";
  if (u === "H") return "h";
  if (u === "S") return "s";
  return "?";
}

function rankPoker(r: string) {
  const u = (r || "").toUpperCase();
  if (u === "10") return "T";
  return u;
}

function formatCardToken(tok: string): string {
  const t = (tok || "").trim();
  if (!t) return "";
  const u = t.toUpperCase();
  if (u === "X" || u === "XX") return "X";

  const suit = u.slice(0, 1);
  const rank = u.slice(1);
  if (!rank) return t;

  return `${rankPoker(rank)}${suitLower(suit)}`;
}

function formatCardsString(s: string): string {
  const parts = (s || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "-";
  return parts.map(formatCardToken).join(" ");
}

function formatBoardPretty(hand: HandRealRow) {
  const flop = hand.flop ? formatCardsString(hand.flop) : "-";
  const turn = hand.turn ? formatCardsString(hand.turn) : "-";
  const river = hand.river ? formatCardsString(hand.river) : "-";
  return { flop, turn, river };
}

function formatAmtBb(a: ActionRealRow) {
  const v = Number(a.sum_bb ?? 0);
  if (!Number.isFinite(v) || Math.abs(v) < 1e-9) return "";
  const s = v.toFixed(2).replace(/\.00$/, "");
  return ` ${s}bb`;
}

export function RealHandModal({
  open,
  dbPath,
  hand,
  onClose,
}: {
  open: boolean;
  dbPath: string;
  hand: HandRealRow | null;
  onClose: () => void;
}) {
  const [actions, setActions] = React.useState<ActionRealRow[]>([]);
  const [status, setStatus] = React.useState<string>("idle");

  React.useEffect(() => {
    let alive = true;
    async function run() {
      if (!open || !hand) return;
      setStatus("loading...");
      try {
        const data = await fetchActionsRealForHand(dbPath, hand.id);
        if (!alive) return;
        setActions(data);
        setStatus("ok (" + data.length + ")");
      } catch (e: any) {
        if (!alive) return;
        setActions([]);
        setStatus("ERROR: " + (e?.message || String(e)));
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [open, hand, dbPath]);

  if (!open || !hand) return null;

  const byStreet = new Map<number, ActionRealRow[]>();
  for (const a of actions) {
    const k = Number(a.round_no ?? 0);
    if (!byStreet.has(k)) byStreet.set(k, []);
    byStreet.get(k)!.push(a);
  }

  const streets = [1, 2, 3, 4].filter((n) => (byStreet.get(n) || []).length > 0);
  const board = formatBoardPretty(hand);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 18,
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          padding: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Hand {hand.gamecode} <span style={{ fontWeight: 400, opacity: 0.7 }}>({hand.room} / {hand.hero})</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
              {hand.startdate || ""} | SB {hand.sb} / BB {hand.bb} | DB: {dbPath}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Hero cards</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              {formatCardsString(hand.hero_cards || "")}
            </div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Board</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <div><b>Flop:</b> {board.flop}</div>
              <div><b>Turn:</b> {board.turn}</div>
              <div><b>River:</b> {board.river}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.8 }}>
          Actions: {status}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {streets.length === 0 ? (
            <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, opacity: 0.8 }}>
              No hay acciones en actions_real para esta mano.
            </div>
          ) : (
            streets.map((roundNo) => (
              <div key={roundNo} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{streetLabel(roundNo)}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(byStreet.get(roundNo) || []).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        fontSize: 13,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "#fafafa",
                        border: "1px solid #f1f1f1",
                      }}
                    >
                      <div style={{ whiteSpace: "nowrap" }}>
                        <b>{a.player}</b> {a.type_name}
                        <span style={{ opacity: 0.8 }}>{formatAmtBb(a)}</span>
                      </div>
                      <div style={{ opacity: 0.6, whiteSpace: "nowrap" }}>
                        #{a.round_no}.{a.action_no}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>Ver players_json</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
{hand.players_json || ""}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default RealHandModal;
