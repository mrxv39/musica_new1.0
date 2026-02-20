/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\StrategyPage.tsx
 */
import { useMemo, useRef, useState } from "react";
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

      {/* ÚNICO sitio donde mostramos mensajes (error/ok) => el test encuentra 1 match */}
      {ctrl.error && (
        <div
          role="alert"
          style={{
            background: "#ffe6e6",
            color: "#990000",
            padding: "8px 12px",
            margin: "8px 0",
            borderRadius: "6px",
            fontSize: "14px",
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
