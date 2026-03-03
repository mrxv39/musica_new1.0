/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * DB boundary (SQLite real via @tauri-apps/plugin-sql)
 * - Guarda OR ranges como 4 columnas (no JSON)  ✅
 * - Guarda OR plan (move + bet_min/max) en payload_json ✅
 * - Carga OR ranges desde columnas y OR plan desde payload_json ✅
 *
 * + Situations CRUD:
 *   - list
 *   - create (upsert)
 *   - rename
 *   - delete (warn si tiene subs; force => cascada)
 *
 * Refactor: moved implementation to ./db/repo
 */
export * from "./db/repo";
