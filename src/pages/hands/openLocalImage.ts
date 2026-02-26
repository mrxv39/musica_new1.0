/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\openLocalImage.ts
import { openPath } from "@tauri-apps/plugin-opener";

export async function openLocalImage(path: string) {
  const p = (path || "").trim();
  if (!p) return;
  try {
    await openPath(p);
  } catch (e) {
    console.error("openPath failed", e);
  }
}
