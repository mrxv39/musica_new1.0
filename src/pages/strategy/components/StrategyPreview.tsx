/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategyPreview.tsx
 */
import React, { useMemo } from "react";
import type { SubStrategyPayload } from "../../../strategy/types";

type Props = {
  payload: SubStrategyPayload;
};

export default function StrategyPreview({ payload }: Props) {
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  return (
    <section className="strategy-preview">
      <div className="strategy-preview__title">Preview</div>
      <textarea className="strategy-preview__json" value={json} readOnly rows={18} />
    </section>
  );
}
