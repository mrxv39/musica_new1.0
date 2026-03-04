/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\PlayersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { listPlayers, updatePlayerTipo, PlayerRow } from "../db/players";

const TIPO_OPTIONS = ["fish", "reg"] as const;

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const rows = await listPlayers();
      setPlayers(rows);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) => p.name.toLowerCase().includes(needle));
  }, [players, q]);

  async function setTipo(p: PlayerRow, newTipo: string) {
    const t = String(newTipo).trim();
    if (!t || t === p.tipo) return;

    // optimistic UI
    setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, tipo: t } : x)));

    setSavingId(p.id);
    setError("");
    try {
      await updatePlayerTipo(p.id, t);
    } catch (e: any) {
      // rollback
      setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, tipo: p.tipo } : x)));
      setError(String(e?.message ?? e));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <h2>Players</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player..."
          style={{ minWidth: 220 }}
        />
        <button onClick={reload} disabled={loading}>
          {loading ? "Loading..." : "Reload"}
        </button>
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px" }}>
              ID
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px" }}>
              Name
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px" }}>
              Tipo
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px" }}>
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 60 }}>
                {p.id}
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px" }}>{p.name}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 160 }}>
                <select
                  value={p.tipo}
                  onChange={(e) => setTipo(p, e.target.value)}
                  disabled={savingId === p.id}
                >
                  {TIPO_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  {/* si hay tipos raros en DB, mantenerlos visibles */}
                  {!TIPO_OPTIONS.includes(p.tipo as any) && <option value={p.tipo}>{p.tipo}</option>}
                </select>
                {savingId === p.id && <span style={{ marginLeft: 8, fontSize: 12 }}>saving…</span>}
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 220 }}>
                {p.created_at}
              </td>
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "10px 8px", color: "#666" }}>
                No players.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}