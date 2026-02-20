/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\editor\editorStyles.ts
 */
import type React from "react";

export const cardStyle: React.CSSProperties = {
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

export const subCardStyle: React.CSSProperties = {
  border: "1px solid #f0f0f0",
  borderRadius: 10,
  padding: 12,
  background: "#fff",
};

export const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: 10,
};

export const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #f0f0f0",
  margin: "14px 0",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  display: "block",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
};

export const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 8,
};

export const grid3Cols: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "start",
};

export const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};
