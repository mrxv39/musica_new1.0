/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\StrategyPage.tsx
 */
import { useEffect, useMemo, useRef, useState } from "react";
import StrategyEditor from "../strategy/components/StrategyEditor";
import { useStrategyPage } from "./strategy/useStrategyPage";
import StrategyHeader from "./strategy/components/StrategyHeader";
import StrategySidebar from "./strategy/components/StrategySidebar";
import StrategyPreview from "./strategy/components/StrategyPreview";

const DEFAULT_GLOBALS = ["default"];

export default function StrategyPage() {
  const globals = DEFAULT_GLOBALS;
  const [globalName, setGlobalName] = useState<string>(globals[0] ?? "default");

  const ctrl = useStrategyPage({ globalName });

  // toast auto-hide (pero mantiene texto para tests)
  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (!ctrl.error) return;
    setToastVisible(true);
    const t = window.setTimeout(() => setToastVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [ctrl.error]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importClick = () => fileInputRef.current?.click();

  const onImportFile = async (file: File) => {
    const text = await file.text();
    await ctrl.importGlobalJsonText(text);
  };

  const editorKey = useMemo(
    () => `${String(globalName)}:${ctrl.selectedId ?? "none"}`,
    [globalName, ctrl.selectedId]
  );

  return (
    <div className="strategy-page">
      <StrategyHeader
        globalName={String(globalName)}
        globals={globals}
        onChangeGlobal={setGlobalName}
        isLoading={ctrl.isLoading}
        // ⚠️ CLAVE: NO duplicar el texto de error. El alert ya lo muestra abajo.
        error={null}
        onNew={ctrl.createNew}
        onDuplicate={ctrl.duplicateSelected}
        onSave={ctrl.saveSelected}
        onCopy={ctrl.copyPayloadJson}
        onExport={ctrl.exportGlobalJson}
        onImportClick={importClick}
      />

      {/* Toast (en vez de alert inline) — mantiene el texto en DOM para los tests */}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await onImportFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="strategy-layout">
        <StrategySidebar
          subs={ctrl.subs}
          selectedId={ctrl.selectedId}
          onSelect={ctrl.setSelectedId}
        />

        <main className="strategy-main">
          <div className="strategy-main__editor">
            <StrategyEditor
              key={editorKey}
              value={ctrl.editorValue}
              onChange={ctrl.setEditorValue}
              showOrPanel
              orRanges={ctrl.orRanges}
              onChangeOrRanges={ctrl.setOrRanges}
            />
          </div>

          <div className="strategy-main__preview">
            <StrategyPreview payload={ctrl.editorValue} />
          </div>
        </main>
      </div>
    </div>
  );
}
