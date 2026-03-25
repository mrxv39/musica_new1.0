/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\PlayersPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listPlayers,
  updatePlayerTipo,
  updatePlayerNotes,
  resetPlayersTable,
  listAliases,
  addAlias,
  removeAlias,
  PlayerRow,
  PlayerAlias,
} from "../db/players";

const TIPO_OPTIONS = ["fish", "reg", "nit", "lag", "tag", "unknown"] as const;

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [resetting, setResetting] = useState(false);

  // Alias panel
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [aliases, setAliases] = useState<PlayerAlias[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [aliasLoading, setAliasLoading] = useState(false);

  // Notes editing
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesText, setNotesText] = useState("");

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

    setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, tipo: t } : x)));
    setSavingId(p.id);
    setError("");
    try {
      await updatePlayerTipo(p.id, t);
    } catch (e: any) {
      setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, tipo: p.tipo } : x)));
      setError(String(e?.message ?? e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleResetPlayers() {
    if (!window.confirm("Vaciar players, hand_players y aliases? No se puede deshacer.")) return;
    setResetting(true);
    setError("");
    try {
      await resetPlayersTable();
      setPlayers([]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }

  async function toggleAliases(playerId: number) {
    if (expandedId === playerId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(playerId);
    setAliasLoading(true);
    try {
      setAliases(await listAliases(playerId));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAliasLoading(false);
    }
  }

  async function handleAddAlias(playerId: number) {
    const a = newAlias.trim();
    if (!a) return;
    try {
      await addAlias(playerId, a);
      setNewAlias("");
      setAliases(await listAliases(playerId));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function handleRemoveAlias(aliasId: number, playerId: number) {
    try {
      await removeAlias(aliasId);
      setAliases(await listAliases(playerId));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function saveNotes(p: PlayerRow) {
    try {
      await updatePlayerNotes(p.id, notesText);
      setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, notes: notesText } : x)));
      setEditingNotesId(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  const totalHands = useMemo(() => players.reduce((s, p) => s + p.hand_count, 0), [players]);

  return (
    <div>
      <h2>Players ({players.length})</h2>

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
        <button onClick={handleResetPlayers} disabled={resetting} style={{ marginLeft: 8 }}>
          {resetting ? "Reseteando..." : "Reset all"}
        </button>
        <span style={{ marginLeft: 8, fontSize: 13, color: "#888" }}>
          {totalHands} total hands tracked
        </span>
        {error && <span style={{ color: "crimson", marginLeft: 8 }}>{error}</span>}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Name", "Tipo", "Hands", "Tournaments", "Notes", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <>
              <tr key={p.id}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", fontWeight: 500 }}>
                  {p.name}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 120 }}>
                  <select
                    value={p.tipo}
                    onChange={(e) => setTipo(p, e.target.value)}
                    disabled={savingId === p.id}
                  >
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {!TIPO_OPTIONS.includes(p.tipo as any) && <option value={p.tipo}>{p.tipo}</option>}
                  </select>
                  {savingId === p.id && <span style={{ marginLeft: 4, fontSize: 11 }}>...</span>}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 70, textAlign: "center" }}>
                  {p.hand_count}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 100, textAlign: "center" }}>
                  {p.tournament_count}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", maxWidth: 250 }}>
                  {editingNotesId === p.id ? (
                    <span style={{ display: "flex", gap: 4 }}>
                      <input
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveNotes(p)}
                        style={{ flex: 1, fontSize: 12 }}
                        autoFocus
                      />
                      <button onClick={() => saveNotes(p)} style={{ fontSize: 11 }}>OK</button>
                      <button onClick={() => setEditingNotesId(null)} style={{ fontSize: 11 }}>X</button>
                    </span>
                  ) : (
                    <span
                      onClick={() => { setEditingNotesId(p.id); setNotesText(p.notes); }}
                      style={{ cursor: "pointer", color: p.notes ? "#333" : "#bbb", fontSize: 12 }}
                    >
                      {p.notes || "click to add notes"}
                    </span>
                  )}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 80 }}>
                  <button onClick={() => toggleAliases(p.id)} style={{ fontSize: 11 }}>
                    {expandedId === p.id ? "Hide" : "Aliases"}
                  </button>
                </td>
              </tr>

              {expandedId === p.id && (
                <tr key={`alias-${p.id}`}>
                  <td colSpan={6} style={{ padding: "4px 8px 12px 24px", background: "#f9f9f9" }}>
                    {aliasLoading ? (
                      <span style={{ fontSize: 12, color: "#888" }}>Loading...</span>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, marginBottom: 4, color: "#666" }}>
                          OCR aliases for <b>{p.name}</b>:
                        </div>
                        {aliases.length === 0 && (
                          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>No aliases yet</div>
                        )}
                        {aliases.map((a) => (
                          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 8, marginBottom: 4, background: "#e8e8e8", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}>
                            {a.alias}
                            <button onClick={() => handleRemoveAlias(a.id, p.id)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "#c00" }}>x</button>
                          </span>
                        ))}
                        <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                          <input
                            value={newAlias}
                            onChange={(e) => setNewAlias(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddAlias(p.id)}
                            placeholder="Add alias..."
                            style={{ fontSize: 12, width: 160 }}
                          />
                          <button onClick={() => handleAddAlias(p.id)} style={{ fontSize: 11 }}>Add</button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "10px 8px", color: "#666" }}>
                No players.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
