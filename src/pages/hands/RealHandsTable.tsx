import React from "react";
import type { HandRealRow } from "../../db";
import RealHandModal from "./RealHandModal";
import RealHandsImageModal from "./RealHandsImageModal";
import RealHandsTableBody from "./RealHandsTableBody";
import RealHandsTableSummary from "./RealHandsTableSummary";

function getSpotPng(h: HandRealRow): string {
  return ((h as any).spot_png as string) || "";
}

function buildSpotTitle(h: HandRealRow): string {
  return `Spot | id=${h.id} | ${h.startdate || ""} | ${h.gamecode || ""}`;
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
          rows={rows}
          getSpotPng={getSpotPng}
          onOpenHand={openHand}
          onOpenImage={openImage}
        />
      </table>

      <RealHandsTableSummary rows={rows} rowsCount={rows.length} dbPath={dbPath} />
    </>
  );
}

export default RealHandsTable;
