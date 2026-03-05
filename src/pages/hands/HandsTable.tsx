/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsTable.tsx
import React from "react";
import type { HandsObsRow } from "../../db";
import { makeHandsColumns } from "./handsColumns";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { HandsSortKey } from "./sortHands";
import { HandsColumnsConfigModal } from "./HandsColumnsConfigModal";

type Props = {
  rows: HandsObsRow[];
  sortKey?: HandsSortKey;
  sortAsc?: boolean;
  onSort?: (key: HandsSortKey) => void;

  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;

  // UI info/log
  lastLog?: string;
  dbPath?: string;
  totalRows?: number;
  shownRows?: number;
  rangeError?: string;
  batchFolderPath?: string;
};

const VISIBLE_COLS_STORAGE_KEY = "hands.visibleColumns";

function safeParseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function uniqStable(xs: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

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

  const [visibleIds, setVisibleIds] = React.useState<string[]>(() => {
    const saved = safeParseJson<string[]>(localStorage.getItem(VISIBLE_COLS_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  });

  React.useEffect(() => {
    const allIds = columns.map((c) => c.id);
    const saved = safeParseJson<string[]>(localStorage.getItem(VISIBLE_COLS_STORAGE_KEY));
    const current = Array.isArray(saved) && saved.length > 0 ? saved : visibleIds.length > 0 ? visibleIds : allIds;

    const curSet = new Set(current);
    const merged = allIds.filter((id) => curSet.has(id) || !Array.isArray(saved) || saved.length === 0);
    const final = uniqStable(merged.length > 0 ? merged : allIds);

    if (visibleIds.length === 0 && (!Array.isArray(saved) || saved.length === 0)) {
      setVisibleIds(final);
      localStorage.setItem(VISIBLE_COLS_STORAGE_KEY, JSON.stringify(final));
      return;
    }

    if (final.length !== uniqStable(current).length) {
      setVisibleIds(final);
      localStorage.setItem(VISIBLE_COLS_STORAGE_KEY, JSON.stringify(final));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  const onChangeVisibleIds = (next: string[]) => {
    const cleaned = uniqStable(next);
    setVisibleIds(cleaned);
    localStorage.setItem(VISIBLE_COLS_STORAGE_KEY, JSON.stringify(cleaned));
  };

  const visibleColumns = React.useMemo(() => {
    if (!visibleIds || visibleIds.length === 0) return columns;
    const set = new Set(visibleIds);
    return columns.filter((c) => set.has(c.id));
  }, [columns, visibleIds]);

  const renderSortArrow = (key?: HandsSortKey) => {
    if (!key) return null;
    if (!sortKey || sortKey !== key) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortAsc ? "↑" : "↓"}</span>;
  };

  const closePreview = () => {
    setPreviewPath("");
    setPreviewRow(null);
  };

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
        <thead>
          <tr>
            {visibleColumns.map((c) => {
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
              {visibleColumns.map((c) => (
                <td key={c.id} style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        Rows: {shown} / {total}
        {dbPath ? ` | DB actual: ${dbPath}` : ""}
      </div>

      {rangeError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#b00020" }}>Rango inválido: {rangeError}</div>
      ) : null}

      {batchFolderPath ? (
        <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>Folder 50-hands: {batchFolderPath}</div>
      ) : null}

      {lastLog ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>Ver log completo (stdout/stderr)</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{lastLog}</pre>
        </details>
      ) : null}
    </>
  );
}

export default HandsTable;