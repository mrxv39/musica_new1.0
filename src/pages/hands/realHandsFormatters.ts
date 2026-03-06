/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\realHandsFormatters.ts

function suitLower(s: string) {
  const u = (s || "").toUpperCase();
  if (u === "C") return "c";
  if (u === "D") return "d";
  if (u === "H") return "h";
  if (u === "S") return "s";
  return "?";
}

function rankPoker(r: string) {
  const u = (r || "").toUpperCase();
  if (u === "10") return "T";
  return u;
}

/**
 * Token DB examples:
 *  - "CK" (suit first) => Kc
 *  - "D10" => Td
 *  - "HA" => Ah
 *  - "X" / "XX" => X
 */
export function formatCardToken(tok: string): string {
  const t = (tok || "").trim();
  if (!t) return "";
  const u = t.toUpperCase();
  if (u === "X" || u === "XX") return "X";

  const suit = u.slice(0, 1);
  const rank = u.slice(1);

  if (!rank) return t;

  return `${rankPoker(rank)}${suitLower(suit)}`;
}

export function formatCardsString(s: string): string {
  const parts = (s || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "-";
  return parts.map(formatCardToken).join(" ");
}

export function formatBoardCompact(flop: string, turn: string, river: string): string {
  const f = flop ? `F:${formatCardsString(flop)}` : "F:-";
  const t = turn ? `T:${formatCardsString(turn)}` : "T:-";
  const r = river ? `R:${formatCardsString(river)}` : "R:-";
  return `${f} ${t} ${r}`;
}
