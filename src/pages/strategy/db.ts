/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * DB boundary (stub).
 * IMPORTANTE: ahora dbSaveSub devuelve info para UI (situationKey/bucket),
 * porque actions.ts lo usa para el status.
 */
import type { StrategyStore, SubStrategyItem } from "../../strategy/types";

export type DbSaveSubResult = {
  situationKey: string;
  bucket: string;
};

// En tu implementación real, aquí irá la inicialización (tauri/sqlite/etc)
export async function dbInit(): Promise<void> {
  return;
}

// Cargar todas las subs de un "global"
export async function dbLoadSubs(globalName: string): Promise<StrategyStore> {
  // Implementación real puede ser distinta; para UI/tests vale que exista y esté tipada.
  return { globals: { [globalName]: { name: globalName, subs: [] } } } as unknown as StrategyStore;
}

// Guardar 1 subestrategia (persistible)
export async function dbSaveSub(item: SubStrategyItem): Promise<DbSaveSubResult> {
  // Stub: devolvemos keys útiles para status.
  const situationKey = String((item as any)?.payload?.situacion ?? "unknown");
  const bucket = "BASE";
  return { situationKey, bucket };
}
