import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { DEFAULT_DB_PATH, extractP1Stack, fetchLatestHandsObs, HandsObsRow } from "./db";

function formatTs(ms?: number) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function App() {
  const [dbPath, setDbPath] = useState<string>(() => localStorage.getItem("dbPath") || DEFAULT_DB_PATH);
  const [rows, setRows] = useState<HandsObsRow[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");

  const canLoad = useMemo(() => dbPath.trim().length > 0, [dbPath]);

  async function loadOnce() {
    const p = dbPath.trim();
    if (!p) return;
    localStorage.setItem("dbPath", p);

    setStatus("loading...");
    try {
      const data = await fetchLatestHandsObs(p, 50);
      setRows(data);
      setStatus(`ok (${data.length})`);
    } catch (e: any) {
      setRows([]);
      setStatus(`ERROR: ${e?.message || String(e)}`);
    }
  }

  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  useEffect(() => {
    // first load
    loadOnce();

    if (!auto) return;
    const t = window.setInterval(() => {
      loadOnce();
    }, 1500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Poker Boss</h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 14 }}>DB:</label>
        <input
          style={{ width: 560, maxWidth: "100%", padding: 8 }}
          value={dbPath}
          onChange={(e) => setDbPath(e.target.value)}
        />
        <button style={{ padding: "8px 12px" }} onClick={loadOnce} disabled={!canLoad}>
          Refresh
        </button>

        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto (1.5s)
        </label>

        <span style={{ fontSize: 13, opacity: 0.85 }}>{status}</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>time</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>mano_raw</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>p1_stack</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>preflop_ok</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>noboard_ok</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>hand_class</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>fingerprint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const p1 = extractP1Stack(r.ocr_json);
              return (
                <tr key={r.id ?? r.fingerprint ?? idx}>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {formatTs(r.detected_at_ms)}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee" }}>{r.mano_raw || ""}</td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee" }}>{p1 ?? ""}</td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee" }}>
                    {String(r.preflop_ok ?? "")}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee" }}>
                    {String(r.noboard_ok ?? "")}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee" }}>{r.hand_class || ""}</td>
                  <td style={{ padding: 6, borderBottom: "1px solid #eee", fontFamily: "monospace", fontSize: 12 }}>
                    {r.fingerprint || ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          DB actual: <span style={{ fontFamily: "monospace" }}>{dbPath}</span>
        </div>
      </div>
    </div>
  );
}
