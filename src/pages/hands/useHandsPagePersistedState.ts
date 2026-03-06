// /// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsPagePersistedState.ts

import { useEffect, useState } from "react";
import { DEFAULT_DB_PATH } from "../../db";
import type { HandsMode } from "../hands/HandsToolbar";

export function useHandsPagePersistedState() {
  // ===== Mode (OBS vs REAL) =====
  const [mode, setMode] = useState<HandsMode>(() => {
    const saved = (localStorage.getItem("hands.mode") || "OBS").toUpperCase();
    return saved === "REAL" ? "REAL" : "OBS";
  });

  useEffect(() => {
    localStorage.setItem("hands.mode", mode);
  }, [mode]);

  // ===== DB path (shared) =====
  const [dbPath, setDbPath] = useState<string>(() => localStorage.getItem("dbPath") || DEFAULT_DB_PATH);

  // ===== Auto refresh (shared) =====
  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");
  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  const canLoad = dbPath.trim().length > 0;

  return { mode, setMode, dbPath, setDbPath, auto, setAuto, canLoad };
}