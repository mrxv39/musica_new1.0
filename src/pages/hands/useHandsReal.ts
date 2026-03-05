/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsReal.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchLatestHandsReal, HandRealRow } from "../../db";

export function useHandsReal(dbPath: string, auto: boolean) {
  const [rows, setRows] = useState<HandRealRow[]>([]);
  const [status, setStatus] = useState<string>("idle");

  const canLoad = useMemo(() => dbPath.trim().length > 0, [dbPath]);

  const loadOnce = useCallback(async () => {
    const p = dbPath.trim();
    if (!p) return;

    setStatus("loading...");
    try {
      const data = await fetchLatestHandsReal(p, 250);
      setRows(data);
      setStatus("ok (" + data.length + ")");
    } catch (e: any) {
      setRows([]);
      setStatus("ERROR: " + (e?.message || String(e)));
    }
  }, [dbPath]);

  useEffect(() => {
    loadOnce();
    if (!auto) return;

    const t = window.setInterval(loadOnce, 3000);
    return () => window.clearInterval(t);
  }, [auto, loadOnce]);

  return { rows, status, canLoad, loadOnce };
}
