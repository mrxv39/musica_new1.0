/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsObs.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_DB_PATH, fetchLatestHandsObs, HandsObsRow } from "../../db";

export function useHandsObs() {
  const [dbPath, setDbPath] = useState<string>(
    () => localStorage.getItem("dbPath") || DEFAULT_DB_PATH
  );
  const [rows, setRows] = useState<HandsObsRow[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [auto, setAuto] = useState<boolean>(
    () => (localStorage.getItem("autoRefresh") || "true") === "true"
  );

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

  useEffect(() => {
    loadOnce();
    if (!auto) return;

    const t = window.setInterval(loadOnce, 1500);
    return () => window.clearInterval(t);
  }, [auto, loadOnce]);

  return {
    dbPath,
    setDbPath,
    rows,
    status,
    auto,
    setAuto,
    canLoad,
    loadOnce,
  };
}
