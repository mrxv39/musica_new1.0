/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsPagePaths.ts

import {
  BATCH_FOLDER_PATH as CONFIG_BATCH_FOLDER_PATH,
  PROJECT_ROOT,
  CHAMPION_XML_DIR as CONFIG_CHAMPION_XML_DIR,
  XML_ARCHIVE_DIR as CONFIG_XML_ARCHIVE_DIR,
  SPOTS_OUT_BASE as CONFIG_SPOTS_OUT_BASE,
  CHAMPION_HERO as CONFIG_CHAMPION_HERO,
} from "../../config";

// Re-export concrete values from central config so existing callers
// (and tests that mock this module) keep the same public API.
export const BATCH_FOLDER_PATH = CONFIG_BATCH_FOLDER_PATH;

// === REAL (XML import) paths (ajusta si cambia el usuario/carpeta) ===
export { PROJECT_ROOT };
export const CHAMPION_XML_DIR = CONFIG_CHAMPION_XML_DIR;
export const XML_ARCHIVE_DIR = CONFIG_XML_ARCHIVE_DIR;
export const SPOTS_OUT_BASE = CONFIG_SPOTS_OUT_BASE;

// ✅ HERO fijo para Champion
export const CHAMPION_HERO = CONFIG_CHAMPION_HERO;

export function summarize(s: string, max = 220) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + " …" : t;
}

export function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
