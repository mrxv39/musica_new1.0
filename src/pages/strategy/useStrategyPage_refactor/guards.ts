export function isBadSituationKey(s: string): boolean {
  const t = String(s || "").trim();
  if (!t) return true;
  if (t === "unknown") return true;
  if (/undefined/i.test(t)) return true;
  return false;
}
