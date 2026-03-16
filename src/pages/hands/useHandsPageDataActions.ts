import { invoke } from "@tauri-apps/api/core";

import {
  CHAMPION_HERO,
  CHAMPION_XML_DIR,
  XML_ARCHIVE_DIR,
  summarize,
} from "./handsPagePaths";

import { getErrorMessage } from "./handsPageUtils";

type LoadOnceFn = () => Promise<void>;

type UseHandsPageDataActionsArgs = {
  mode: "OBS" | "REAL";
  safeDbPath: string;
  setBusy: (v: boolean) => void;
  setActionStatus: (v: string) => void;
  setLastLog: (v: string) => void;
  loadObsOnce: LoadOnceFn;
  loadRealOnce: LoadOnceFn;
  /** When set, Reset button calls reset_four_tables and then this to reload all 4 tables. */
  loadAllFourTables?: LoadOnceFn;
  /** Optional callback to clear in-memory workerProfile rows when resetting tables. */
  clearWorkerProfile?: () => void;
};

export function useHandsPageDataActions({
  mode,
  safeDbPath,
  setBusy,
  setActionStatus,
  setLastLog,
  loadObsOnce,
  loadRealOnce,
  loadAllFourTables,
  clearWorkerProfile,
}: UseHandsPageDataActionsArgs) {
  const onReset = async () => {
    const p = safeDbPath;

    setBusy(true);
    setActionStatus("reset: running...");
    setLastLog("");

    try {
      if (loadAllFourTables) {
        if (!window.confirm("¿Vaciar las 4 tablas (tournaments, hands, spots, players)? Esta acción no se puede deshacer.")) {
          setBusy(false);
          return;
        }
        const msg = await invoke<string>("reset_four_tables", { dbPath: p });
        const m = String(msg || "");
        setLastLog(m);
        setActionStatus("reset: " + (summarize(m) || "ok"));
        if (clearWorkerProfile) {
          clearWorkerProfile();
        }
        await loadAllFourTables();
      } else {
        const cmd = mode === "REAL" ? "reset_hands_real" : "reset_hands_obs";
        const msg = await invoke<string>(cmd, { dbPath: p });
        const m = String(msg || "");
        setLastLog(m);
        setActionStatus("reset: " + (summarize(m) || "ok"));

        if (mode === "REAL") {
          await loadRealOnce();
        } else {
          await loadObsOnce();
        }
      }
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("reset: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  const onImportXml = async () => {
    const p = safeDbPath;

    setBusy(true);
    setActionStatus("import xml: running...");
    setLastLog("");

    try {
      const msg = await invoke<string>("import_champion_xml", {
        dbPath: p,
        xmlDir: CHAMPION_XML_DIR,
        archiveDir: XML_ARCHIVE_DIR,
        hero: CHAMPION_HERO,
      });

      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("import xml: " + (summarize(m) || "ok"));
      await loadRealOnce();
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("import xml: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  return {
    onReset,
    onImportXml,
  };
}
