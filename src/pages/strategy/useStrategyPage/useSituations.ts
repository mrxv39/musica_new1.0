/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\useSituations.ts
 */
import { useCallback, useState } from "react";

import {
  dbListSituations,
  dbUpsertSituation,
  dbRenameSituationKey,
  dbDeleteSituationKey,
  dbCountSubsForSituationKey,
} from "../db";

type SetError = (v: string | null) => void;

export function useSituations(args: {
  setIsLoading: (v: boolean) => void;
  setError: SetError;
  setEditorValueClean: React.Dispatch<React.SetStateAction<any>>;
  reload: () => Promise<any>;
  setSubsView?: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const { setIsLoading, setError, setEditorValueClean, reload, setSubsView } = args;

  const [situations, setSituations] = useState<string[]>(() => []);

  const refreshSituations = useCallback(async () => {
    const rows = await dbListSituations();
    const keys = (rows ?? []).map((r: any) => String(r?.key ?? "")).filter((k) => k.length > 0);
    setSituations(keys);
    return keys;
  }, []);

  const createSituation = useCallback(
    async (key: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await dbUpsertSituation(key);
        await refreshSituations();
        setEditorValueClean((prev: any) => ({ ...(prev as any), situacion: String(key).trim() }) as any);
        setError("Situation creada");
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        setError(`Situation CREATE ERROR: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshSituations, setEditorValueClean, setError, setIsLoading]
  );

  const renameSituation = useCallback(
    async (from: string, to: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await dbRenameSituationKey(from, to);
        await refreshSituations();

        setEditorValueClean((prev: any) => {
          const cur = String((prev as any)?.situacion ?? "");
          if (cur === from) return { ...(prev as any), situacion: to } as any;
          return prev;
        });

        if (setSubsView) {
          setSubsView((prev) =>
            prev.map((it: any) => {
              const name = String(it?.name ?? "");
              if (name.startsWith(from + " • ")) return { ...it, name: name.replace(from + " • ", to + " • ") };
              return it;
            })
          );
        }

        setError("Situation renombrada");
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        setError(`Situation RENAME ERROR: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshSituations, setEditorValueClean, setError, setIsLoading, setSubsView]
  );

  const deleteSituation = useCallback(
    async (key: string) => {
      setIsLoading(true);
      setError(null);
      try {
        // sin force: si hay subs -> db layer debe throw SITUATION_HAS_SUBS:<n>
        await dbCountSubsForSituationKey(key);
        await dbDeleteSituationKey(key, { force: false });

        await refreshSituations();

        setEditorValueClean((prev: any) => {
          const cur = String((prev as any)?.situacion ?? "");
          if (cur === key) return { ...(prev as any), situacion: "" } as any;
          return prev;
        });

        setError("Situation borrada");
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        if (msg.startsWith("SITUATION_HAS_SUBS:")) throw e;
        setError(`Situation DELETE ERROR: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshSituations, setEditorValueClean, setError, setIsLoading]
  );

  const deleteSituationForce = useCallback(
    async (key: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await dbDeleteSituationKey(key, { force: true });
        await refreshSituations();

        // recarga subs (se pudieron borrar en cascada)
        await reload();

        setEditorValueClean((prev: any) => {
          const cur = String((prev as any)?.situacion ?? "");
          if (cur === key) return { ...(prev as any), situacion: "" } as any;
          return prev;
        });

        setError("Situation borrada (force)");
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        setError(`Situation DELETE ERROR: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshSituations, reload, setEditorValueClean, setError, setIsLoading]
  );

  return {
    situations,
    setSituations, // útil para preload desde reload()
    refreshSituations,
    createSituation,
    renameSituation,
    deleteSituation,
    deleteSituationForce,
  };
}

