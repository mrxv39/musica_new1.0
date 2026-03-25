import React from "react";
import type { HandRealRow } from "../../db";
import RealHandModal from "./RealHandModal";
import RealHandsImageModal from "./RealHandsImageModal";
import RealHandsTableBody, { REAL_HANDS_BODY_COLUMN_IDS } from "./RealHandsTableBody";
import RealHandsTableSummary from "./RealHandsTableSummary";

const REAL_HANDS_HEADER_LABELS: Record<string, string> = {
  icon: "📷",
  gamecode: "Gamecode",
  startdate: "Start",
  blinds: "Blinds",
  hero_cards: "Hero cards",
  board: "Board",
  ocr_audit: "OCR Audit",
  tournament: "Tournament",
  room_hero: "Room/Hero",
};

const thStyle = { textAlign: "left" as const, borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" as const };

type AuditFilter =
  | "all"
  | "no_ocr"
  | "cards_diff"
  | "warn_stacks"
  | "warn_bets"
  | "warn_pos"
  | "warn_dealer"
  | "warn_table";

function getSpotPng(h: HandRealRow): string {
  const frames = (h as any).spot_frames as { image_path?: string | null }[] | undefined;
  const fromSpotLinks = frames?.find((frame) => String(frame?.image_path || "").trim())?.image_path;
  if (fromSpotLinks) return String(fromSpotLinks);
  return ((h as any).spot_png as string) || "";
}

function buildSpotTitle(h: HandRealRow): string {
  return `Spot | id=${h.id} | ${h.startdate || ""} | ${h.gamecode || ""}`;
}

function matchesAuditFilter(h: HandRealRow, filter: AuditFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "no_ocr":
      return h.linked_obs_id == null;
    case "cards_diff":
      return h.ocr_cards_match === false;
    case "warn_stacks":
      return !!h.ocr_warn_stacks;
    case "warn_bets":
      return !!h.ocr_warn_bets;
    case "warn_pos":
      return !!h.ocr_warn_pos;
    case "warn_dealer":
      return !!h.ocr_warn_dealer;
    case "warn_table":
      return !!h.ocr_warn_table;
    default:
      return true;
  }
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: active ? "1px solid #999" : "1px solid #ddd",
        background: active ? "#efefef" : "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}

const copyBtnStyle: React.CSSProperties = { padding: "2px 6px", fontSize: 11, cursor: "pointer", borderRadius: 4, border: "1px solid #ccc", background: "#fff" };

export function RealHandsTable({
  rows,
  dbPath,
  visibleColumnIds,
}: {
  rows: HandRealRow[];
  dbPath: string;
  /** When set, only these columns are shown (order preserved). */
  visibleColumnIds?: string[];
}) {
  const [openHandModal, setOpenHandModal] = React.useState(false);
  const [selectedHand, setSelectedHand] = React.useState<HandRealRow | null>(null);

  const [openImageModal, setOpenImageModal] = React.useState(false);
  const [imagePath, setImagePath] = React.useState<string>("");
  const [imageTitle, setImageTitle] = React.useState<string>("");

  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  async function copyHandJson(h: HandRealRow) {
    const payload: any = {
      id: h.id,
      gamecode: h.gamecode,
      startdate: h.startdate,
      sb: h.sb,
      bb: h.bb,
      hero_cards: h.hero_cards,
      flop: h.flop,
      turn: h.turn,
      river: h.river,
      tournament_name: h.tournament_name ?? null,
    };
    try {
      const pj = h.players_json ? JSON.parse(h.players_json) : null;
      if (pj) payload.players = pj;
    } catch { /* ignore */ }
    if (h.linked_ocr_json) {
      try {
        payload.ocr = JSON.parse(h.linked_ocr_json as string);
      } catch { /* ignore */ }
    }
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(h.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === h.id ? null : prev)), 1200);
    } catch {
      window.alert("No se pudo copiar al portapapeles.");
    }
  }

  const [auditFilter, setAuditFilter] = React.useState<AuditFilter>("all");

  const filteredRows = React.useMemo(
    () => rows.filter((h) => matchesAuditFilter(h, auditFilter)),
    [rows, auditFilter]
  );

  const openHand = (h: HandRealRow) => {
    setSelectedHand(h);
    setOpenHandModal(true);
  };

  const closeHand = () => {
    setOpenHandModal(false);
    setSelectedHand(null);
  };

  const openImage = (h: HandRealRow) => {
    const p = getSpotPng(h);
    if (!p) return;
    setImagePath(p);
    setImageTitle(buildSpotTitle(h));
    setOpenImageModal(true);
  };

  const closeImage = () => {
    setOpenImageModal(false);
    setImagePath("");
    setImageTitle("");
  };

  const headerColumns =
    visibleColumnIds && visibleColumnIds.length > 0
      ? visibleColumnIds.filter((id) => REAL_HANDS_BODY_COLUMN_IDS.includes(id as (typeof REAL_HANDS_BODY_COLUMN_IDS)[number]))
      : [...REAL_HANDS_BODY_COLUMN_IDS];

  return (
    <>
      <RealHandModal open={openHandModal} dbPath={dbPath} hand={selectedHand} onClose={closeHand} />
      <RealHandsImageModal open={openImageModal} title={imageTitle} imagePath={imagePath} onClose={closeImage} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <FilterButton active={auditFilter === "all"} label="All" onClick={() => setAuditFilter("all")} />
        <FilterButton active={auditFilter === "no_ocr"} label="No OCR" onClick={() => setAuditFilter("no_ocr")} />
        <FilterButton active={auditFilter === "cards_diff"} label="Cards diff" onClick={() => setAuditFilter("cards_diff")} />
        <FilterButton active={auditFilter === "warn_stacks"} label="Stacks warn" onClick={() => setAuditFilter("warn_stacks")} />
        <FilterButton active={auditFilter === "warn_bets"} label="Bets warn" onClick={() => setAuditFilter("warn_bets")} />
        <FilterButton active={auditFilter === "warn_pos"} label="Pos warn" onClick={() => setAuditFilter("warn_pos")} />
        <FilterButton active={auditFilter === "warn_dealer"} label="Dealer warn" onClick={() => setAuditFilter("warn_dealer")} />
        <FilterButton active={auditFilter === "warn_table"} label="Table warn" onClick={() => setAuditFilter("warn_table")} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 64 }}>Copy</th>
            {headerColumns.map((id) => (
              <th key={id} style={thStyle}>
                {REAL_HANDS_HEADER_LABELS[id] ?? id}
              </th>
            ))}
          </tr>
        </thead>

        <RealHandsTableBody
          rows={filteredRows}
          getSpotPng={getSpotPng}
          onOpenHand={openHand}
          onOpenImage={openImage}
          visibleColumnIds={visibleColumnIds && visibleColumnIds.length > 0 ? visibleColumnIds : undefined}
          copyHandJson={copyHandJson}
          copiedId={copiedId}
        />
      </table>

      <RealHandsTableSummary rowsCount={filteredRows.length} />
    </>
  );
}

export default RealHandsTable;
