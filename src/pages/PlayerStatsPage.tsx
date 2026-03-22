import { useEffect, useMemo, useState } from "react";
import {
  listPlayerStats,
  getPlayerStatsDetail,
  PlayerStatsComputed,
} from "../db/playerStats";

type SortKey = keyof PlayerStatsComputed;

const TABLE_SIZE_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "All", value: null },
  { label: "HU (2)", value: 2 },
  { label: "3H (3)", value: 3 },
];

const COLUMNS: Array<{ key: SortKey; label: string; fmt?: (v: number) => string }> = [
  { key: "player", label: "Player" },
  { key: "total_hands", label: "Hands" },
  { key: "vpip", label: "VPIP%", fmt: (v) => `${v}%` },
  { key: "pfr", label: "PFR%", fmt: (v) => `${v}%` },
  { key: "threeb", label: "3Bet%", fmt: (v) => `${v}%` },
  { key: "fold_to_3b_pct", label: "F3B%", fmt: (v) => `${v}%` },
  { key: "limp_pct", label: "Limp%", fmt: (v) => `${v}%` },
  { key: "af", label: "AF", fmt: (v) => `${v}` },
  { key: "wtsd", label: "WTSD%", fmt: (v) => `${v}%` },
];

function vpipColor(vpip: number): string {
  if (vpip >= 50) return "#2e7d32"; // fish — green
  if (vpip >= 30) return "#f9a825"; // reg — yellow
  return "#c62828"; // shark — red
}

function vpipLabel(vpip: number): string {
  if (vpip >= 50) return "fish";
  if (vpip >= 30) return "reg";
  return "shark";
}

export default function PlayerStatsPage() {
  const [rows, setRows] = useState<PlayerStatsComputed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [tableSize, setTableSize] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_hands");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerStatsComputed[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await listPlayerStats(10, tableSize);
      setRows(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [tableSize]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.player.toLowerCase().includes(needle));
  }, [rows, q]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortAsc ? an - bn : bn - an;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  async function openDetail(player: string) {
    setSelectedPlayer(player);
    setDetailLoading(true);
    try {
      setDetail(await getPlayerStatsDetail(player));
    } catch {
      setDetail([]);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <h2>Player Stats ({rows.length} players)</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name..."
          style={{ minWidth: 200 }}
        />
        <span style={{ fontSize: 13 }}>Table size:</span>
        {TABLE_SIZE_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setTableSize(opt.value)}
            style={{
              fontWeight: tableSize === opt.value ? 700 : 400,
              background: tableSize === opt.value ? "#1976d2" : "#eee",
              color: tableSize === opt.value ? "#fff" : "#333",
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={reload} disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? "Loading..." : "Reload"}
        </button>
        {error && <span style={{ color: "crimson", marginLeft: 8 }}>{error}</span>}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Type</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
              >
                {col.label}
                {sortKey === col.key ? (sortAsc ? " \u25B2" : " \u25BC") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={`${r.player}-${r.table_size}`}
              onClick={() => openDetail(r.player)}
              style={{ cursor: "pointer" }}
            >
              <td style={{ ...tdStyle, width: 60, textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fff",
                    background: vpipColor(r.vpip),
                  }}
                >
                  {vpipLabel(r.vpip)}
                </span>
              </td>
              {COLUMNS.map((col) => {
                const val = r[col.key];
                const display = col.fmt && typeof val === "number" ? col.fmt(val) : String(val);
                return (
                  <td
                    key={col.key}
                    style={{
                      ...tdStyle,
                      textAlign: col.key === "player" ? "left" : "center",
                      fontWeight: col.key === "player" ? 500 : 400,
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} style={{ padding: "12px 8px", color: "#666" }}>
                {loading ? "Loading..." : "No player stats found. Run the stats engine from the backend first."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Detail panel */}
      {selectedPlayer && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fafafa",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{selectedPlayer} — Detail by table size</h3>
            <button onClick={() => setSelectedPlayer(null)} style={{ fontSize: 12 }}>
              Close
            </button>
          </div>

          {detailLoading ? (
            <p style={{ color: "#888" }}>Loading...</p>
          ) : detail.length === 0 ? (
            <p style={{ color: "#888" }}>No stats for this player.</p>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Table Size</th>
                  <th style={thStyle}>Hands</th>
                  <th style={thStyle}>VPIP%</th>
                  <th style={thStyle}>PFR%</th>
                  <th style={thStyle}>3Bet%</th>
                  <th style={thStyle}>F3B%</th>
                  <th style={thStyle}>Limp%</th>
                  <th style={thStyle}>AF</th>
                  <th style={thStyle}>WTSD%</th>
                  <th style={thStyle}>Type</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((d) => (
                  <tr key={d.table_size}>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 500 }}>
                      {d.table_size === 2 ? "HU" : d.table_size === 3 ? "3H" : `${d.table_size}P`}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.total_hands}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.vpip}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.pfr}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.threeb}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.fold_to_3b_pct}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.limp_pct}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.af}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{d.wtsd}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#fff",
                          background: vpipColor(d.vpip),
                        }}
                      >
                        {vpipLabel(d.vpip)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "center",
  borderBottom: "2px solid #ddd",
  padding: "6px 8px",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f0f0f0",
  padding: "5px 8px",
};
