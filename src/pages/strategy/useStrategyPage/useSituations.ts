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

// Normalizamos a shape que la UI suele esperar: { key }
type SituationItem = { key: string };

// Aceptamos input flexible para no romper callers antiguos
function normalizeSituations(input: any): SituationItem[] {
  const arr = Array.isArray(input) ? input : [];
  const out: SituationItem[] = [];

  for (const it of arr) {
    if (typeof it === "string") {
      const k = it.trim();
      if (k) out.push({ key: k });
      continue;
    }
    const k = String(it?.key ?? it?.name ?? it?.value ?? "").trim();
    if (k) out.push({ key: k });
  }

  // dedupe manteniendo orden
  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.key)) return false;
    seen.add(x.key);
    return true;
  });
}

export function useSituations(args: {
  setIsLoading: (v: boolean) => void;
  setError: SetError;
  setEditorValueClean: React.Dispatch<React.SetStateAction<any>>;
  reload: () => Promise<any>;
  setSubsView?: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const { setIsLoading, setError, setEditorValueClean, reload, setSubsView } = args;

  // ⚠️ antes era string[]; ahora es [{key}] para que el <select> no muestre undefined
  const [situations, _setSituations] = useState<SituationItem[]>(() => []);

  // Setter “compatible” (acepta string[] o {key}[])
  const setSituations = useCallback((v: any) => {
    _setSituations(normalizeSituations(v));
  }, []);

  const refreshSituations = useCallback(async () => {
    const rows = await dbListSituations();
    const items = normalizeSituations((rows ?? []).map((r: any) => ({ key: String(r?.key ?? "") })));
    _setSituations(items);
    return items;
  }, []);

  const createSituation = useCallback(
    async (key: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const k = String(key ?? "").trim();
        await dbUpsertSituation(k);
        await refreshSituations();
        setEditorValueClean((prev: any) => ({ ...(prev as any), situacion: k }) as any);
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
    situations, // ahora [{key}] (evita undefined en el select)
    setSituations, // setter compatible
    refreshSituations,
    createSituation,
    renameSituation,
    deleteSituation,
    deleteSituationForce,
  };
}