/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\editor\EditorFields.tsx
 */
import type { CSSProperties } from "react";
import { inputStyle as defaultInputStyle, labelStyle as defaultLabelStyle } from "./editorStyles";
import { clampNum2, safeNumFromInput } from "./numberUtils";

type BaseProps = {
  label: string;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  labelStyle,
  inputStyle,
}: BaseProps & {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label style={labelStyle ?? defaultLabelStyle}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={inputStyle ?? defaultInputStyle}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 0.01,
  labelStyle,
  inputStyle,
}: BaseProps & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label style={labelStyle ?? defaultLabelStyle}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(clampNum2(safeNumFromInput(e.currentTarget.valueAsNumber), min, max))}
        onBlur={() => onChange(clampNum2(value, min, max))}
        style={inputStyle ?? defaultInputStyle}
      />
    </label>
  );
}
