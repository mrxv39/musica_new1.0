/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsPagePaths.ts

export const BATCH_FOLDER_PATH =
  "C:\\\\Users\\\\Usuario\\\\Desktop\\\\proyectos\\\\poker_boss\\\\modules\\\\preflop\\\\test_images";

// === REAL (XML import) paths (ajusta si cambia el usuario/carpeta) ===
export const PROJECT_ROOT = "C:\\\\Users\\\\Usuario\\\\Desktop\\\\proyectos\\\\poker_boss";
export const CHAMPION_XML_DIR =
  "C:\\\\Users\\\\Usuario\\\\Desktop\\\\Nueva carpeta\\\\ChampionPoker\\\\Championpoker\\\\data\\\\xavieeee2\\\\History\\\\Data\\\\Tournaments";
export const XML_ARCHIVE_DIR = `${PROJECT_ROOT}\\\\data\\\\xml_imported`;
export const SPOTS_OUT_BASE = `${PROJECT_ROOT}\\\\data\\\\spots_raw\\\\time_spots`;

// ✅ HERO fijo para Champion
export const CHAMPION_HERO = "xavieeee2";

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
