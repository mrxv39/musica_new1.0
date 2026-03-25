import { useEffect, useMemo, useState } from "react";
import { listPlayerStats, ComputedStats } from "../db/playerStats";

type SortKey = keyof ComputedStats;
type SortDir = "asc" | "desc";

const STAT_COLS: { key: SortKey; label: string; fmt?: (v: number) => string }[] = [
  { key: "total_hands", label: "Hands" },
  { key: "vpip", label: "VPIP%", fmt: (v) => v.toFixed(1) },
  { key: "pfr", label: "PFR%", fmt: (v) => v.toFixed(1) },
  { key: "threeb", label: "3Bet%", fmt: (v) => v.toFixed(1) },
  { key: "fold3b", label: "F3B%", fmt: (v) => v.toFixed(1) },
  { key: "fourb", label: "4Bet%", fmt: (v) => v.toFixed(1) },
  { key: "limp", label: "Limp%", fmt: (v) => v.toFixed(1) },
  { key: "af", label: "AF", fmt: (v) => v.toFixed(1) },
  { key: "wtsd", label: "WTSD%", fmt: (v) => v.toFixed(1) },
  { key: "winrate", label: "Win%", fmt: (v) => v.toFixed(1) },
];

const TABLE_SIZE_LABELS: Record<number, string> = { 2: "HU", 3: "3H" };

function playerColor(vpip: number): string {
  if (vpip >= 40) return "#16a34a"; // green — fish
  if (vpip >= 25) return "#ca8a04"; // yellow — reg
  return "#dc2626"; // red — shark
}

function playerLabel(vpip: number): string {
  if (vpip >= 40) return "fish";
  if (vpip >= 25) return "reg";
  return "shark";
}

export default function PlayerStatsPage() {
  const [rows, setRows] = useState<ComputedStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [tableSize, setTableSize] = useState<number | 0>(0); // 0 = all
  const [sortKey, setSortKey] = useState<SortKey>("total_hands");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<ComputedStats | null>(null);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setRows(await listPlayerStats());
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (tableSize) list = list.filter((r) => r.table_size === tableSize);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((r) => r.player.toLowerCase().includes(needle));
    return list;
  }, [rows, q, tableSize]);

  const sorted = useMemo(() => {
    const k = sortKey;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a[k] ?? 0;
      const vb = b[k] ?? 0;
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const thStyle: React.CSSProperties = {
    textAlign: "right",
    borderBottom: "2px solid #444",
    padding: "6px 10px",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontSize: 13,
  };

  const tdStyle: React.CSSProperties = {
    textAlign: "right",
    borderBottom: "1px solid #333",
    padding: "5px 10px",
    fontSize: 13,
  };

  return (
    <div>
      <h2>Player Stats</h2>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player..."
          style={{ minWidth: 200 }}
        />
        <select value={tableSize} onChange={(e) => setTableSize(Number(e.target.value))}>
          <option value={0}>All sizes</option>
          <option value={2}>HU (2)</option>
          <option value={3}>3-Handed (3)</option>
        </select>
        <button onClick={reload} disabled={loading}>
          {loading ? "Loading..." : "Reload"}
        </button>
        <span style={{ fontSize: 13, color: "#999" }}>
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div
          style={{
            border: "1px solid #444",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
            background: "#1a1a2e",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: playerColor(selected.vpip),
                  marginRight: 8,
                }}
              />
              {selected.player}
              <span style={{ fontSize: 13, color: "#999", marginLeft: 8 }}>
                ({TABLE_SIZE_LABELS[selected.table_size] ?? selected.table_size})
                {" — "}
                {playerLabel(selected.vpip)}
              </span>
            </h3>
            <button onClick={() => setSelected(null)} style={{ fontSize: 12 }}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {STAT_COLS.map((col) => {
              const val = selected[col.key];
              const display = col.fmt && typeof val === "number" ? col.fmt(val) : String(val ?? "");
              return (
                <div key={col.key} style={{ background: "#16213e", borderRadius: 4, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>{col.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{display}</div>
                </div>
              );
            })}
            <div style={{ background: "#16213e", borderRadius: 4, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "#888" }}>Won Chips</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{selected.total_won_chips?.toFixed(0)}</div>
            </div>
            <div style={{ background: "#16213e", borderRadius: 4, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "#888" }}>Bet Chips</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{selected.total_bet_chips?.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th
                style={{ ...thStyle, textAlign: "left", width: 40 }}
                onClick={() => toggleSort("player")}
              >
                #
              </th>
              <th
                style={{ ...thStyle, textAlign: "left", minWidth: 120 }}
                onClick={() => toggleSort("player")}
              >
                Player {sortKey === "player" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </th>
              <th style={{ ...thStyle, width: 50 }}>Size</th>
              <th style={{ ...thStyle, width: 50 }}>Type</th>
              {STAT_COLS.map((col) => (
                <th key={col.key} style={thStyle} onClick={() => toggleSort(col.key)}>
                  {col.label} {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const color = playerColor(r.vpip);
              return (
                <tr
                  key={`${r.player}-${r.table_size}`}
                  onClick={() => setSelected(r)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ ...tdStyle, textAlign: "left", color: "#666" }}>{i + 1}</td>
                  <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{r.player}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: 12 }}>
                    {TABLE_SIZE_LABELS[r.table_size] ?? r.table_size}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: color + "22",
                        color,
                        fontWeight: 600,
                      }}
                    >
                      {playerLabel(r.vpip)}
                    </span>
                  </td>
                  {STAT_COLS.map((col) => {
                    const val = r[col.key];
                    const display = col.fmt && typeof val === "number" ? col.fmt(val) : String(val ?? "");
                    return (
                      <td key={col.key} style={tdStyle}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4 + STAT_COLS.length} style={{ padding: "10px 8px", color: "#666" }}>
                  No player stats found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
