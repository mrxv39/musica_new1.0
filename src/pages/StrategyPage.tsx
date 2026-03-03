/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\StrategyPage.tsx
 * Layout top: Spot(1) | Editor(1) | OR(2)
 */
import { useEffect, useMemo, useState } from "react";
import "../strategy/strategy.css";
import "./strategy/strategyPage.css";

import StrategyEditor from "../strategy/components/StrategyEditor";
import OrRangesPanel from "../strategy/components/OrRangesPanel";
import { useStrategyPage } from "./strategy/useStrategyPage";
import StrategySidebar from "./strategy/components/StrategySidebar";
import StrategyPreview from "./strategy/components/StrategyPreview";

export default function StrategyPage() {
  const ctrl = useStrategyPage();

  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (!ctrl.error) return;
    setToastVisible(true);
    const t = window.setTimeout(() => setToastVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [ctrl.error]);

  // editorKey para reset al cambiar selección/spot
  const editorKey = useMemo(
    () => `${String(ctrl.selectedSituationKey ?? "none")}:${ctrl.selectedId ?? "none"}`,
    [ctrl.selectedSituationKey, ctrl.selectedId]
  );

  const situationKey = String(ctrl.selectedSituationKey ?? "").trim() || "unknown";

  // Empty state: no hay spots
  if (!ctrl.isLoading && (ctrl.situations?.length ?? 0) === 0) {
    const onCreateFirst = async () => {
      const k = `spot_${Date.now()}`;
      await ctrl.createSituation(k);
    };

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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              padding: "48px 40px",
              minWidth: 320,
              textAlign: "center",
            }}
          >
            <h2 style={{ marginBottom: 18, fontWeight: 600, fontSize: "2rem" }}>No hay estrategias</h2>
            <button
              onClick={onCreateFirst}
              style={{
                background: "#0078d4",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 28px",
                fontSize: "1.1rem",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              Crear primera estrategia
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ situations ya es string[]
  const situationKeys = (ctrl.situations ?? []).map((s: any) => String(s)).filter((x) => x.trim().length > 0);

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
          globalName={String(ctrl.selectedSituationKey ?? "")}
          // ✅ antes era s.key (mal). Ahora es string directo.
          globals={situationKeys}
          onChangeGlobal={(k) => ctrl.setSelectedSituationKey(String(k))}
          isLoading={ctrl.isLoading}
          status={ctrl.error ?? ""}
          subs={ctrl.subs}
          selectedId={ctrl.selectedId}
          onSelect={ctrl.setSelectedId}
          onNew={ctrl.createNew}
          onDuplicate={ctrl.duplicateSelected}
          onSave={() => ctrl.saveSelected()}
          onCopy={ctrl.copyPayloadJson}
          onDelete={(id) => ctrl.deleteSub(id)}
        />

        <div className="strategy-editorCol">
          <StrategyEditor
            key={editorKey}
            value={(ctrl.editorValue as any) ?? ({} as any)}
            onChange={ctrl.setEditorValue as any}
            showOrPanel={false}
            // ✅ antes era s.key (mal). Ahora string directo.
            situationOptions={situationKeys}
            onCreateSituation={async (k) => ctrl.createSituation(String(k))}
            onRenameSituation={async (from, to) => ctrl.renameSituation(String(from), String(to))}
            // ✅ aunque llegue undefined, useStrategyPage ya blinda y usa selectedSituationKey
            onDeleteSituation={async (k) => ctrl.deleteSituation(k as any)}
            onDeleteSituationForce={async (k) => ctrl.deleteSituationForce(k as any)}
          />
        </div>

        <div className="strategy-orCol">
          <OrRangesPanel situationKey={situationKey} orRanges={ctrl.orRangesRows as any} onChangeOrRanges={ctrl.setOrRangesRows as any} />
        </div>
      </div>

      <div className="strategy-previewWrap">
        <StrategyPreview payload={(ctrl.editorValue as any) ?? (defaultPayload() as any)} />
      </div>
    </div>
  );
}

// local helper para evitar import circular en el render
function defaultPayload(): any {
  return {
    spot: "",
    hero_pos: "",
    hand: "",
    situacion: "",
    p1_bet: 0,
    p1_stack: 0,
    p1_se: 0,
    p2_pos: "",
    p2_tipo: "",
    p2_bet: 0,
    p2_stack: 0,
    p3_pos: "",
    p3_tipo: "",
    p3_bet: 0,
    p3_stack: 0,
    orRanges: {},
    orRangesPlan: {},
  };
}