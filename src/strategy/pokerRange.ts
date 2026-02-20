/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\pokerRange.ts
 *
 * Validador "estricto" de listas de rangos para OR ranges.
 * Acepta una lista separada por comas. Cada item debe cumplir UNO de estos formatos:
 *   - Pares: "AA" o "AA-TT" (descendente por rango)  [permitimos "AA" suelto]
 *   - Suited/offsuit: "AKs" o "AKs-A6s" (misma primera carta, segunda desciende)
 *   - Offsuit: "AKo" o "AKo-A6o"
 *
 * Restricciones:
 * - Solo A,K,Q,J,T,9..2
 * - No se aceptan "+" ni "-" inválidos ni "TT-AA" (ascendente)
 * - Items vacíos se ignoran (permitimos espacios)
 */

export type ValidateResult = { ok: true } | { ok: false; error: string };

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
type Rank = (typeof RANKS)[number];

function rankIndex(r: string): number {
  return RANKS.indexOf(r as Rank);
}

function isRank(r: string): r is Rank {
  return rankIndex(r) >= 0;
}

function trimUpper(s: string) {
  return (s ?? "").trim().toUpperCase();
}

function parsePairToken(tok: string): { a: Rank; b: Rank } | null {
  // "AA"
  if (tok.length !== 2) return null;
  const r1 = tok[0];
  const r2 = tok[1];
  if (!isRank(r1) || !isRank(r2)) return null;
  if (r1 !== r2) return null;
  return { a: r1, b: r2 };
}

function parseSuitedToken(tok: string): { hi: Rank; lo: Rank; sfx: "S" | "O" } | null {
  // "AKS" or "AKO"
  if (tok.length !== 3) return null;
  const r1 = tok[0];
  const r2 = tok[1];
  const sfx = tok[2];
  if (!isRank(r1) || !isRank(r2)) return null;
  if (r1 === r2) return null; // pares no van aquí
  if (sfx !== "S" && sfx !== "O") return null;

  // orden: queremos que r1 sea >= r2 en jerarquía (A..2)
  const i1 = rankIndex(r1);
  const i2 = rankIndex(r2);
  if (i1 < 0 || i2 < 0) return null;
  if (i1 > i2) {
    // r1 es más bajo que r2 (ej: KA) -> inválido
    return null;
  }

  return { hi: r1, lo: r2, sfx: sfx as "S" | "O" };
}

function validatePairRange(lhs: string, rhs: string): ValidateResult {
  const a = parsePairToken(lhs);
  const b = parsePairToken(rhs);
  if (!a || !b) return { ok: false, error: "Formato par inválido" };

  // Debe ser descendente: AA-TT (A..2 => índices 0..12)
  // AA (0) a TT (4) es 0 <= 4 -> OK
  const ia = rankIndex(a.a);
  const ib = rankIndex(b.a);
  if (ia < 0 || ib < 0) return { ok: false, error: "Rango inválido" };
  if (ia > ib) return { ok: false, error: "Rango debe ser descendente (AA-TT)" };

  return { ok: true };
}

function validateSuitedRange(lhs: string, rhs: string): ValidateResult {
  const a = parseSuitedToken(lhs);
  const b = parseSuitedToken(rhs);
  if (!a || !b) return { ok: false, error: "Formato suited/offsuit inválido" };

  // misma primera carta y mismo sufijo (AKs-A6s)
  if (a.hi !== b.hi) return { ok: false, error: "En rangos tipo AKs-A6s, la primera carta debe coincidir" };
  if (a.sfx !== b.sfx) return { ok: false, error: "El sufijo (s/o) debe coincidir" };

  // segunda carta debe ser descendente: K(1) -> 6(8) es 1 <= 8 OK
  const ia = rankIndex(a.lo);
  const ib = rankIndex(b.lo);
  if (ia < 0 || ib < 0) return { ok: false, error: "Rango inválido" };
  if (ia > ib) return { ok: false, error: "Rango debe ser descendente (AKs-A6s)" };

  return { ok: true };
}

/**
 * Valida una lista: "AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s"
 */
export function validatePokerRangeList(input: string): ValidateResult {
  const s = trimUpper(input);
  if (!s) return { ok: true }; // vacío permitido

  const items = s
    .split(",")
    .map(x => trimUpper(x))
    .filter(Boolean);

  for (const it of items) {
    // Prohibimos "+" explícitamente y otros símbolos raros
    if (/[+]/.test(it)) return { ok: false, error: `No se permite "+": ${it}` };
    if (/[^AKQJT98765432SO\-]/.test(it)) return { ok: false, error: `Carácter inválido: ${it}` };

    const parts = it.split("-");
    if (parts.length === 1) {
      // token simple: AA o AKs o AKo
      const tok = parts[0];
      if (parsePairToken(tok)) continue;
      if (parseSuitedToken(tok)) continue;
      return { ok: false, error: `Token inválido: ${it}` };
    }

    if (parts.length === 2) {
      const lhs = parts[0];
      const rhs = parts[1];

      // pares
      if (lhs.length === 2 && rhs.length === 2) {
        const res = validatePairRange(lhs, rhs);
        if (!res.ok) return { ok: false, error: `${res.error}: ${it}` };
        continue;
      }

      // suited/offsuit
      if (lhs.length === 3 && rhs.length === 3) {
        const res = validateSuitedRange(lhs, rhs);
        if (!res.ok) return { ok: false, error: `${res.error}: ${it}` };
        continue;
      }

      return { ok: false, error: `Rango inválido: ${it}` };
    }

    return { ok: false, error: `Demasiados guiones: ${it}` };
  }

  return { ok: true };
}