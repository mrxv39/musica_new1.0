/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsTable.tsx
import React from "react";
import type { HandsObsRow } from "../../db";
import { makeHandsColumns } from "./handsColumns";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { HandsSortKey } from "./sortHands";

type Props = {
  rows: HandsObsRow[];
  sortKey?: HandsSortKey;
  sortAsc?: boolean;
  onSort?: (key: HandsSortKey) => void;
};

export function HandsTable({ rows, sortKey, sortAsc, onSort }: Props) {
  const [previewPath, setPreviewPath] = React.useState<string>("");

  const columns = React.useMemo(() => makeHandsColumns((p) => setPreviewPath(p)), []);

  const renderSortArrow = (key?: HandsSortKey) => {
    if (!key) return null;
    if (!sortKey || sortKey !== key) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortAsc ? "↑" : "↓"}</span>;
  };

  return (
    <>
      {previewPath ? <ImagePreviewModal path={previewPath} onClose={() => setPreviewPath("")} /> : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const canSort = Boolean(c.sortableKey && onSort);
              return (
                <th
                  key={c.id}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: "6px 8px",
                    cursor: canSort ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => {
                    if (c.sortableKey && onSort) onSort(c.sortableKey);
                  }}
                >
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span>{c.label}</span>
                    {renderSortArrow(c.sortableKey)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={(r as any).obs_id ?? i} style={{ borderBottom: "1px solid #f0f0f0" }}>
              {columns.map((c) => (
                <td key={c.id} style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default HandsTable;
