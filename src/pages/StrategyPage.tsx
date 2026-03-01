/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\StrategyPage.tsx
 * Layout top: Estrategia(1) | Editor(1) | OR(2)
 */
import { useEffect, useMemo, useState } from "react";
import "../strategy/strategy.css";
import "./strategy/strategyPage.css";

import StrategyEditor from "../strategy/components/StrategyEditor";
import OrRangesPanel from "../strategy/components/OrRangesPanel";
import { useStrategyPage } from "./strategy/useStrategyPage";
import StrategySidebar from "./strategy/components/StrategySidebar";
import StrategyPreview from "./strategy/components/StrategyPreview";

const FALLBACK_GLOBAL = "main";

export default function StrategyPage() {
  // Fase 1: NO usamos "default" en ningún sitio.
  // Mantengo un único global "main" como puente hasta que migremos a Spot-based.
  const globals = useMemo(() => [FALLBACK_GLOBAL], []);
  const [globalName, setGlobalName] = useState<string>(globals[0] ?? FALLBACK_GLOBAL);

  const ctrl = useStrategyPage({ globalName });

  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (!ctrl.error) return;
    setToastVisible(true);
    const t = window.setTimeout(() => setToastVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [ctrl.error]);

  const editorKey = useMemo(
    () => `${String(globalName)}:${ctrl.selectedId ?? "none"}`,
    [globalName, ctrl.selectedId]
  );

  const situationKey = (ctrl.editorValue as any)?.situacion ?? "unknown";

  return (
    <div className="strategy-page">
      {ctrl.error && toastVisible && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: 14,
            right: 14,
            zIndex: 9999,
            maxWidth: 420,
            background: /error/i.test(ctrl.error) ? "#ffe6e6" : "#e9ffe9",
            color: /error/i.test(ctrl.error) ? "#990000" : "#0b5b0b",
            border: "1px solid rgba(0,0,0,0.08)",
            padding: "10px 12px",
            borderRadius: "10px",
            fontSize: "14px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
          }}
        >
          {ctrl.error}
        </div>
      )}

      <div className="strategy-top3">
        <StrategySidebar
          globalName={String(globalName)}
          globals={globals}
          onChangeGlobal={setGlobalName}
          isLoading={ctrl.isLoading}
          status={ctrl.error ?? ""}
          subs={ctrl.subs}
          selectedId={ctrl.selectedId}
          onSelect={ctrl.setSelectedId}
          onNew={ctrl.createNew}
          onDuplicate={ctrl.duplicateSelected}
          onSave={ctrl.saveSelected}
          onCopy={ctrl.copyPayloadJson}
          onDelete={ctrl.deleteSub}
        />

        <div className="strategy-editorCol">
          <StrategyEditor
            key={editorKey}
            value={ctrl.editorValue}
            onChange={ctrl.setEditorValue}
            showOrPanel={false}
            situationOptions={ctrl.situations}
            onCreateSituation={ctrl.createSituation}
            onRenameSituation={ctrl.renameSituation}
            onDeleteSituation={ctrl.deleteSituation}
            onDeleteSituationForce={ctrl.deleteSituationForce}
          />
        </div>

        <div className="strategy-orCol">
          <OrRangesPanel
            situationKey={situationKey}
            orRanges={ctrl.orRangesRows}
            onChangeOrRanges={ctrl.setOrRangesRows}
          />
        </div>
      </div>

      <div className="strategy-previewWrap">
        <StrategyPreview payload={ctrl.editorValue} />
      </div>
    </div>
  );
}