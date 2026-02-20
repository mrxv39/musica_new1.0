/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * DB boundary. IMPORTANTE: firmar con string para no encorsetar UI/tests a literales ("BASE").
 * Los tests mockean estas funciones, así que no rompemos nada.
 */
import type { StrategyStore, SubStrategyItem } from "../../strategy/types";

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
export async function dbSaveSub(item: SubStrategyItem): Promise<void> {
  void item;
  return;
}
