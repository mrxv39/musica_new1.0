// Centralized configuration for paths and database URLs.
//
// NOTE: For now this preserves the existing absolute paths
// to avoid any behavioural change. A later phase can add
// env overrides (e.g. POKER_BOSS_DATA_ROOT, POKER_BOSS_STRATEGY_DB)
// so the same code works on different machines without editing.

// Project root on the current development machine.
// This matches the hardcoded paths used previously.
export const PROJECT_ROOT =
  "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss";

// Data directory under the project root.
export const DATA_DIR = `${PROJECT_ROOT}\\data`;

// Main Poker Boss DB: estrategia (situations/sub_strategies), hands, players.
// Una sola DB para que el worker (Python) lea las estrategias que creas en la app.
export const HANDS_DB_FILE = `${DATA_DIR}\\poker_boss.db`;

// Strategy and players use the same DB so the worker sees strategies created in the UI.
export const STRATEGY_DB_FILE = HANDS_DB_FILE;
export const PLAYERS_DB_FILE = HANDS_DB_FILE;

// Batch images folder (preflop test images).
export const BATCH_FOLDER_PATH = `${PROJECT_ROOT}\\modules\\preflop\\test_images`;

// Champion Poker XML directory and archive locations.
export const CHAMPION_XML_DIR =
  "C:\\Users\\Usuario\\Desktop\\Nueva carpeta\\ChampionPoker\\Championpoker\\data\\xavieeee2\\History\\Data\\Tournaments";

export const XML_ARCHIVE_DIR = `${DATA_DIR}\\xml_imported`;

// Spots output base for time_spots.
export const SPOTS_OUT_BASE = `${DATA_DIR}\\spots_raw\\time_spots`;

// Fixed hero for Champion XML import.
export const CHAMPION_HERO = "xavieeee2";

// Normalize path to forward slashes for sqlite: URLs (expected by plugin and tests).
function toSqlitePath(p: string): string {
  return p.replace(/\\/g, "/");
}

// Helpers to build database URLs for @tauri-apps/plugin-sql.
export function getStrategyDbUrl(): string {
  return `sqlite:${toSqlitePath(STRATEGY_DB_FILE)}`;
}

export function getPlayersDbUrl(): string {
  return `sqlite:${toSqlitePath(PLAYERS_DB_FILE)}`;
}

export function getHandsDefaultDbPath(): string {
  return HANDS_DB_FILE;
}

