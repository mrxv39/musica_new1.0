import React from "react";
import type { HandRealRow } from "../../db";
import RealHandModal from "./RealHandModal";
import RealHandsImageModal from "./RealHandsImageModal";
import RealHandsTableBody from "./RealHandsTableBody";
import RealHandsTableSummary from "./RealHandsTableSummary";

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

export function RealHandsTable({
  rows,
  dbPath,
}: {
  rows: HandRealRow[];
  dbPath: string;
}) {
  const [openHandModal, setOpenHandModal] = React.useState(false);
  const [selectedHand, setSelectedHand] = React.useState<HandRealRow | null>(null);

  const [openImageModal, setOpenImageModal] = React.useState(false);
  const [imagePath, setImagePath] = React.useState<string>("");
  const [imageTitle, setImageTitle] = React.useState<string>("");

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
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>📷</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Gamecode</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Start</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Blinds</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Hero cards</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Board</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>OCR Audit</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>Room/Hero</th>
          </tr>
        </thead>

        <RealHandsTableBody
          rows={filteredRows}
          getSpotPng={getSpotPng}
          onOpenHand={openHand}
          onOpenImage={openImage}
        />
      </table>

      <RealHandsTableSummary rowsCount={filteredRows.length} />
    </>
  );
}

export default RealHandsTable;
