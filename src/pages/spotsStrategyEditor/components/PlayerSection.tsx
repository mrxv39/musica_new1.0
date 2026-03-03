/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\components\PlayerSection.tsx
 */

import React from "react";

export function PlayerSection({
  title,
  fields,
  getValue,
  onChangeNumber,
  extra,
}: {
  title: string;
  fields: string[];
  getValue: (k: string) => number;
  onChangeNumber: (k: string, v: number) => void;
  extra?: React.ReactNode;
}) {
  return (
    <>
      <h3>{title}</h3>
      {extra}
      {fields.map((k) => (
        <div key={k}>
          {k}
          <input
            type="number"
            value={getValue(k) ?? 0}
            onChange={(e) => onChangeNumber(k, Number(e.target.value))}
          />
        </div>
      ))}
    </>
  );
}