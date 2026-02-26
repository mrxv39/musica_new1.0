// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\App.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { initDB } from "./db/sql";
import {
  DEFAULT_DB_PATH,
  extractBetMax,
  extractBetMin,
  extractMove,
  extractP1Bet,
  extractSituacion,
  extractStackEfectivo,
  extractTempoS,
  fetchLatestHandsObs,
  HandsObsRow,
} from "./db";
import StrategyPage from "./pages/StrategyPage";

type Tab = "hands" | "strategy" | "account" | "import";

function formatDateOnly(ms?: number) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return String(ms);
  }
}

function formatTempoS(v: number | null): string {
  if (v === null) return "";
  // 3 decimales como en tu output: 6.684
  return v.toFixed(3);
}

function TopNav({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "hands", label: "Hands" },
    { key: "strategy", label: "Strategy" },
    { key: "account", label: "Account" },
    { key: "import", label: "Import" },
  ];

  return (
    <div className="top-nav">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={"top-nav-tab" + (activeTab === t.key ? " active" : "")}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ paddingTop: 12 }}>
      <h3 style={{ margin: "8px 0 6px 0" }}>{title}</h3>
      <div style={{ opacity: 0.75 }}>Coming soon</div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>("hands");

  const [dbPath, setDbPath] = useState<string>(() => localStorage.getItem("dbPath") || DEFAULT_DB_PATH);
  const [rows, setRows] = useState<HandsObsRow[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");

  const canLoad = useMemo(() => dbPath.trim().length > 0, [dbPath]);

  const loadOnce = useCallback(async () => {
    const p = dbPath.trim();
    if (!p) return;
    localStorage.setItem("dbPath", p);

    setStatus("loading...");
    try {
      const data = await fetchLatestHandsObs(p, 50);
      setRows(data);
      setStatus("ok (" + data.length + ")");
    } catch (e: any) {
      setRows([]);
      setStatus("ERROR: " + (e?.message || String(e)));
    }
  }, [dbPath]);

  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  // ✅ polling SOLO en la pestaña Hands
  useEffect(() => {
    if (activeTab !== "hands") return;

    loadOnce();

    if (!auto) return;

    const t = window.setInterval(() => {
      loadOnce();
    }, 1500);

    return () => window.clearInterval(t);
  }, [activeTab, auto, loadOnce]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0, marginBottom: 10 }}>Poker Boss</h2>

      <TopNav activeTab={activeTab} onChange={setActiveTab} />

      <div className="page-content">
        {activeTab === "hands" && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 14 }}>DB:</label>
              <input
                style={{ width: 520, padding: "6px 8px", fontSize: 13 }}
                value={dbPath}
                onChange={(e) => setDbPath(e.target.value)}
              />
              <button disabled={!canLoad} onClick={loadOnce}>
                Refresh
              </button>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                Auto (1.5s)
              </label>

              <span style={{ fontSize: 13, opacity: 0.8 }}>{status}</span>
            </div>

            <div style={{ marginTop: 10, borderTop: "1px solid #ddd" }} />

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  <th style={{ padding: "8px 6px" }}>time</th>
                  <th style={{ padding: "8px 6px" }}>mano_raw</th>
                  <th style={{ padding: "8px 6px" }}>stackefectivo</th>
                  <th style={{ padding: "8px 6px" }}>p1bet</th>
                  <th style={{ padding: "8px 6px" }}>move</th>
                  <th style={{ padding: "8px 6px" }}>betmin</th>
                  <th style={{ padding: "8px 6px" }}>betmax</th>
                  <th style={{ padding: "8px 6px" }}>situacion</th>
                  <th style={{ padding: "8px 6px" }}>TEMPO (s)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const stackefectivo = extractStackEfectivo(r.ocr_json);
                  const p1bet = extractP1Bet(r.ocr_json);
                  const move = extractMove(r.ocr_json);
                  const betmin = extractBetMin(r.ocr_json);
                  const betmax = extractBetMax(r.ocr_json);
                  const situacion = extractSituacion(r.ocr_json);
                  const tempoS = extractTempoS(r.ocr_json);

                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px" }}>{formatDateOnly(r.detected_at_ms)}</td>
                      <td style={{ padding: "6px" }}>{r.mano_raw}</td>
                      <td style={{ padding: "6px" }}>{stackefectivo ?? ""}</td>
                      <td style={{ padding: "6px" }}>{p1bet ?? ""}</td>
                      <td style={{ padding: "6px" }}>{move}</td>
                      <td style={{ padding: "6px" }}>{betmin ?? ""}</td>
                      <td style={{ padding: "6px" }}>{betmax ?? ""}</td>
                      <td style={{ padding: "6px" }}>{situacion}</td>
                      <td style={{ padding: "6px" }}>{formatTempoS(tempoS)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>DB actual: {dbPath.trim()}</div>
          </>
        )}

        {activeTab === "strategy" && <StrategyPage />}
        {activeTab === "account" && <ComingSoon title="Account" />}
        {activeTab === "import" && <ComingSoon title="Import" />}
      </div>
    </div>
  );
}
