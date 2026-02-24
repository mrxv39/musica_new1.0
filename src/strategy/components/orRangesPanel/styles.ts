/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\orRangesPanel\styles.ts
 */
import type React from "react";

/**
 * OrRangeRow.tsx importa:
 * - inputStyle
 * - selectStyle
 *
 * Otros componentes pueden importar:
 * - cardStyle, headerRow, fieldLabel, labelTitle
 */

export const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "white",
};

export const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

export const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

export const labelTitle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: 14,
  outline: "none",
};

export const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: 14,
  outline: "none",
};
