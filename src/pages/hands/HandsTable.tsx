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
import { extractLocalImagePath } from "./handsUtils";

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
  const navigableRows = React.useMemo(() => rows.filter((row) => Boolean(extractLocalImagePath(row))), [rows]);
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);

  const closePreview = () => {
    setPreviewIndex(null);
  };

  const openPreview = React.useCallback(
    (_path: string, row: HandsObsRow) => {
      const directIndex = navigableRows.findIndex((candidate) => candidate === row);
      if (directIndex >= 0) {
        setPreviewIndex(directIndex);
        return;
      }

      const rowId = (row as any).obs_id ?? (row as any).id;
      const imagePath = extractLocalImagePath(row);
      const fallbackIndex = navigableRows.findIndex((candidate) => {
        const candidateId = (candidate as any).obs_id ?? (candidate as any).id;
        return candidateId === rowId && extractLocalImagePath(candidate) === imagePath;
      });

      if (fallbackIndex >= 0) setPreviewIndex(fallbackIndex);
    },
    [navigableRows]
  );

  React.useEffect(() => {
    if (previewIndex === null) return;
    if (navigableRows.length === 0 || previewIndex >= navigableRows.length) {
      setPreviewIndex(null);
    }
  }, [navigableRows, previewIndex]);

  const [configOpen, setConfigOpen] = React.useState<boolean>(false);

  const columns = React.useMemo(
    () => makeHandsColumns(openPreview, rows?.[0] ?? null),
    [openPreview, rows]
  );

  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(columns, VISIBLE_COLS_STORAGE_KEY);

  const shown = typeof shownRows === "number" ? shownRows : rows.length;
  const total = typeof totalRows === "number" ? totalRows : rows.length;

  return (
    <>
      {previewIndex !== null && navigableRows[previewIndex] ? (
        <ImagePreviewModal
          rows={navigableRows}
          currentIndex={previewIndex}
          canRunOne={canRunOne}
          onRunOneForImage={onRunOneForImage}
          onSelectIndex={setPreviewIndex}
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
        rangeError={rangeError}
        batchFolderPath={batchFolderPath}
        lastLog={lastLog}
      />
    </>
  );
}

export default HandsTable;
