/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\openLocalImage.ts
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

function toFileUrl(p: string): string {
  // Windows: C:\Users\... -> file:///C:/Users/...
  if (/^[a-zA-Z]:[\\/]/.test(p)) {
    const s = p.replace(/\\/g, "/");
    return "file:///" + s;
  }
  // ya parece url o path unix
  if (/^file:\/\//i.test(p) || /^https?:\/\//i.test(p)) return p;
  return "file://" + p;
}

export async function openLocalImage(path: string) {
  const p0 = (path || "").trim();
  if (!p0) return;

  try {
    // 1) intento directo (path)
    await openPath(p0);
    return;
  } catch (e1) {
    console.error("openPath failed, fallback to file url", e1);
  }

  try {
    // 2) fallback a file:///
    const url = toFileUrl(p0);
    await openUrl(url);
  } catch (e2) {
    console.error("openUrl failed", e2);
    // feedback visible (para no “silenciar”)
    alert("No se pudo abrir la imagen.\n\n" + String(e2));
  }
}
