/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\Main.tsx
 */
import type { SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import StrategyEditor from "../../strategy/components/StrategyEditor";

export default function Main(props: { payload: SubStrategyPayload; generated: SubStrategyItem; onChange: (p: SubStrategyPayload) => void }) {
  const { payload, generated, onChange } = props;

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
        <StrategyEditor value={payload} onChange={onChange} showOrPanel />
      </div>

      <div className="strategy-output">
        <div className="strategy-output-title">Salida (preview)</div>
        <textarea readOnly value={JSON.stringify(generated, null, 2)} />
      </div>
    </main>
  );
}
