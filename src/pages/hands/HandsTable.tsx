import React from "react";
import type { HandsObsRow } from "../../db";
import { makeHandsColumns } from "./handsColumns";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { HandsSortKey } from "./sortHands";
import { HandsColumnsConfigModal } from "./HandsColumnsConfigModal";
import { useVisibleColumns } from "./useVisibleColumns";
import HandsTableHeader from "./HandsTableHeader";
import HandsTableBody from "./HandsTableBody";
import HandsTableSummary from "./HandsTableSummary";

type Props = {
  rows: HandsObsRow[];
  sortKey?: HandsSortKey;
  sortAsc?: boolean;
  onSort?: (key: HandsSortKey) => void;

  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;

  lastLog?: string;
  dbPath?: string;
  totalRows?: number;
  shownRows?: number;
  rangeError?: string;
  batchFolderPath?: string;
};

const VISIBLE_COLS_STORAGE_KEY = "hands.visibleColumns";

export function HandsTable({
  rows,
  sortKey,
  sortAsc,
  onSort,
  canRunOne,
  onRunOneForImage,
  lastLog,
  dbPath,
  totalRows,
  shownRows,
  rangeError,
  batchFolderPath,
}: Props) {
  const [previewPath, setPreviewPath] = React.useState<string>("");
  const [previewRow, setPreviewRow] = React.useState<HandsObsRow | null>(null);

  const closePreview = () => {
    setPreviewPath("");
    setPreviewRow(null);
  };

  const [configOpen, setConfigOpen] = React.useState<boolean>(false);

  const columns = React.useMemo(
    () =>
      makeHandsColumns(
        (p, r) => {
          setPreviewPath(p);
          setPreviewRow(r);
        },
        rows?.[0] ?? null
      ),
    [rows]
  );

  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(columns, VISIBLE_COLS_STORAGE_KEY);

  const shown = typeof shownRows === "number" ? shownRows : rows.length;
  const total = typeof totalRows === "number" ? totalRows : rows.length;

  return (
    <>
      {previewPath ? (
        <ImagePreviewModal
          path={previewPath}
          row={previewRow}
          canRunOne={canRunOne}
          onRunOneForImage={onRunOneForImage}
          onClose={closePreview}
        />
      ) : null}

      <HandsColumnsConfigModal
        open={configOpen}
        columns={columns}
        visibleIds={visibleIds.length > 0 ? visibleIds : columns.map((c) => c.id)}
        onChangeVisibleIds={onChangeVisibleIds}
        onClose={() => setConfigOpen(false)}
        storageKey={VISIBLE_COLS_STORAGE_KEY}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          onClick={() => setConfigOpen(true)}
          style={{
            padding: "6px 10px",
            cursor: "pointer",
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 8,
          }}
          title="Selecciona qué columnas se ven"
        >
          Config
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <HandsTableHeader columns={visibleColumns} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
        <HandsTableBody rows={rows} visibleColumns={visibleColumns} />
      </table>

      <HandsTableSummary
        shown={shown}
        total={total}
        dbPath={dbPath}
        rangeError={rangeError}
        batchFolderPath={batchFolderPath}
        lastLog={lastLog}
      />
    </>
  );
}

export default HandsTable;
