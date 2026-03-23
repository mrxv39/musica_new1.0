/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsObs.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_DB_PATH, fetchLatestHandsObs, HandsObsRow, updateObsReviewStatus } from "../../db";

export type ReviewFilter = "all" | "pending" | "ok" | "error";

export function useHandsObs() {
  const [dbPath, setDbPath] = useState<string>(DEFAULT_DB_PATH);
  const [rows, setRows] = useState<HandsObsRow[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [auto, setAuto] = useState<boolean>(
    () => (localStorage.getItem("autoRefresh") || "true") === "true"
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(
    () => (localStorage.getItem("reviewFilter") as ReviewFilter) || "all"
  );

  const canLoad = useMemo(() => dbPath.trim().length > 0, [dbPath]);

  const loadOnce = useCallback(async () => {
    const p = dbPath.trim();
    if (!p) return;
    localStorage.setItem("dbPath", p);

    setStatus("loading...");
    try {
      const filter = reviewFilter === "all" ? null : reviewFilter;
      const data = await fetchLatestHandsObs(p, 500, filter);
      setRows(data);
      setStatus("ok (" + data.length + ")");
    } catch (e: any) {
      setRows([]);
      setStatus("ERROR: " + (e?.message || String(e)));
    }
  }, [dbPath, reviewFilter]);

  const markReview = useCallback(
    async (obsId: number, reviewStatus: "ok" | "error" | null) => {
      const p = dbPath.trim();
      if (!p) return;
      await updateObsReviewStatus(p, obsId, reviewStatus);
      // Update local state immediately
      setRows((prev) =>
        prev.map((r) =>
          (r.obs_id ?? r.id) === obsId ? { ...r, review_status: reviewStatus } : r
        )
      );
    },
    [dbPath]
  );

  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  useEffect(() => {
    localStorage.setItem("reviewFilter", reviewFilter);
  }, [reviewFilter]);

  useEffect(() => {
    loadOnce();
    if (!auto) return;

    const t = window.setInterval(loadOnce, 5000);
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
    reviewFilter,
    setReviewFilter,
    markReview,
  };
}
