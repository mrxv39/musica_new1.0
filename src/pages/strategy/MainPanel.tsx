/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\MainPanel.tsx
 */
import type { SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import StrategyEditor from "../../strategy/components/StrategyEditor";

type Props = {
  payload: SubStrategyPayload;
  generated: SubStrategyItem;
  onChangePayload: (p: SubStrategyPayload) => void;
};

export default function MainPanel({ payload, generated, onChangePayload }: Props) {
  return (
    <main className="strategy-main">
      <div className="strategy-header">
        <div>
          <div className="strategy-h1">Strategy</div>
          <div className="muted">id generado: {generated.id}</div>
        </div>
        <div className="muted">situacion: {payload.situacion}</div>
      </div>

      <div className="strategy-card">
        <StrategyEditor value={payload} onChange={onChangePayload} showOrPanel />
      </div>

      <div className="strategy-output">
        <div className="strategy-output-title">Salida (preview)</div>
        <textarea readOnly value={JSON.stringify(generated, null, 2)} />
      </div>
    </main>
  );
}
