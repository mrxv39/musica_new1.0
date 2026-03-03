/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\components\OrBlocksEditor.tsx
 */

import { REQUIRED_OR_BLOCK_KEYS } from "../payload";

export function OrBlocksEditor({
  payload,
  onUpdate,
}: {
  payload: any;
  onUpdate: (path: string[], value: any) => void;
}) {
  return (
    <>
      <h3>OR Blocks</h3>

      {REQUIRED_OR_BLOCK_KEYS.map((key) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <strong>{key}</strong>

          <div>
            min
            <input
              type="number"
              value={payload?.or_blocks?.[key]?.min ?? 0}
              onChange={(e) =>
                onUpdate(["or_blocks", key, "min"], Number(e.target.value))
              }
            />
          </div>

          <div>
            max
            <input
              type="number"
              value={payload?.or_blocks?.[key]?.max ?? 0}
              onChange={(e) =>
                onUpdate(["or_blocks", key, "max"], Number(e.target.value))
              }
            />
          </div>

          <div>
            range
            <input
              value={payload?.or_blocks?.[key]?.range ?? ""}
              onChange={(e) =>
                onUpdate(["or_blocks", key, "range"], e.target.value)
              }
            />
          </div>
        </div>
      ))}
    </>
  );
}