/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsTableHeader.tsx

import React from "react";
import type { HandsSortKey } from "./sortHands";

type Column = {
  id: string;
  label: string;
  sortableKey?: HandsSortKey;
};

function SortArrow({ sortKey, sortAsc, colKey }: { sortKey?: HandsSortKey; sortAsc?: boolean; colKey?: HandsSortKey }) {
  if (!colKey) return null;
  if (!sortKey || sortKey !== colKey) return <span style={{ opacity: 0.35 }}>↕</span>;
  return <span>{sortAsc ? "↑" : "↓"}</span>;
}

export function HandsTableHeader({
  columns,
  sortKey,
  sortAsc,
  onSort,
}: {
  columns: Column[];
  sortKey?: HandsSortKey;
  sortAsc?: boolean;
  onSort?: (key: HandsSortKey) => void;
}) {
  return (
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
                <SortArrow sortKey={sortKey} sortAsc={sortAsc} colKey={c.sortableKey} />
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export default HandsTableHeader;
