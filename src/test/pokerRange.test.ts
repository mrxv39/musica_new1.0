/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\pokerRange.test.ts
 */
import { describe, it, expect } from "vitest";
import { validatePokerRangeList } from "../strategy/pokerRange";

describe("pokerRange.validatePokerRangeList (strict)", () => {
  it("acepta vacío", () => {
    expect(validatePokerRangeList("").ok).toBe(true);
    expect(validatePokerRangeList("   ").ok).toBe(true);
  });

  it("acepta pares sueltos y rangos descendentes", () => {
    expect(validatePokerRangeList("AA").ok).toBe(true);
    expect(validatePokerRangeList("TT").ok).toBe(true);
    expect(validatePokerRangeList("AA-TT").ok).toBe(true);
    expect(validatePokerRangeList("KK-QQ").ok).toBe(true);
  });

  it("rechaza rango de pares ascendente", () => {
    const r = validatePokerRangeList("TT-AA");
    expect(r.ok).toBe(false);
  });

  it("acepta suited/offsuit token simple", () => {
    expect(validatePokerRangeList("AKs").ok).toBe(true);
    expect(validatePokerRangeList("AKo").ok).toBe(true);
    expect(validatePokerRangeList("KQs").ok).toBe(true);
    expect(validatePokerRangeList("T9s").ok).toBe(true);
  });

  it("rechaza suited/offsuit con orden inválido (KA s/o)", () => {
    const r1 = validatePokerRangeList("KAs");
    expect(r1.ok).toBe(false);

    const r2 = validatePokerRangeList("KAo");
    expect(r2.ok).toBe(false);
  });

  it("acepta rangos suited/offsuit descendentes con misma primera carta", () => {
    expect(validatePokerRangeList("AKs-A6s").ok).toBe(true);
    expect(validatePokerRangeList("AKo-A6o").ok).toBe(true);
    expect(validatePokerRangeList("JTs-J6s").ok).toBe(true);
    expect(validatePokerRangeList("T9s-T8s").ok).toBe(true);
  });

  it("rechaza rangos suited/offsuit si cambia primera carta o sufijo", () => {
    const a = validatePokerRangeList("AKs-K6s"); // cambia primera carta
    expect(a.ok).toBe(false);

    const b = validatePokerRangeList("AKs-A6o"); // cambia sufijo
    expect(b.ok).toBe(false);
  });

  it("rechaza rangos suited/offsuit ascendentes", () => {
    const r = validatePokerRangeList("A6s-AKs");
    expect(r.ok).toBe(false);
  });

  it("rechaza '+' y caracteres inválidos", () => {
    expect(validatePokerRangeList("77+").ok).toBe(false);
    expect(validatePokerRangeList("AKx").ok).toBe(false);
    expect(validatePokerRangeList("AKs;AA").ok).toBe(false);
  });

  it("rechaza guiones de más y formatos mixtos", () => {
    expect(validatePokerRangeList("AA-TT-99").ok).toBe(false);
    expect(validatePokerRangeList("AA-AKs").ok).toBe(false);
    expect(validatePokerRangeList("AKs-A6").ok).toBe(false);
  });

  it("acepta lista completa típica", () => {
    const r = validatePokerRangeList("AA-TT,AKs-A6s,KQs,JTs-J6s,T9s-T8s");
    expect(r.ok).toBe(true);
  });

  it("rechaza lista si un item es inválido", () => {
    const r = validatePokerRangeList("AA-TT,AKs-A6s,77+");
    expect(r.ok).toBe(false);
  });
});