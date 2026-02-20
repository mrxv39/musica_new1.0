/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\hooks.ts
 */
import { useEffect } from "react";
import type { StrategyGlobal } from "../../strategy/constants";
import type { StrategyStore, SubStrategyPayload } from "../../strategy/types";
import { listSubs } from "../../strategy/store";
import { normalizePayload } from "../../strategy/utils";
import { defaultPayload } from "./defaults";
import { dbInit, dbLoadSubs } from "./db";

export function useStrategyDBLifecycle(args: {
  globalName: StrategyGlobal;
  setStore: (s: StrategyStore) => void;
  setSelectedId: (id: string | null) => void;
  setPayload: (p: SubStrategyPayload) => void;
  setStatus: (s: string) => void;
}) {
  const { globalName, setStore, setSelectedId, setPayload, setStatus } = args;

  async function refreshFromDB(nextGlobal = globalName) {
    try {
      const next = await dbLoadSubs(nextGlobal);
      setStore(next);

      const loaded = listSubs(next, nextGlobal);
      if (loaded.length > 0) {
        const first = loaded[0];
        setSelectedId(first.id);
        setPayload(normalizePayload(first.payload));
      } else {
        setSelectedId(null);
        setPayload(defaultPayload());
      }
    } catch (e: any) {
      setStatus(`DB Load ERROR: ${e?.message || String(e)}`);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await dbInit();
        await refreshFromDB(globalName);
      } catch (e: any) {
        setStatus(`DB init/load ERROR: ${e?.message || String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedId(null);
    setStatus("");
    refreshFromDB(globalName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  return { refreshFromDB };
}
