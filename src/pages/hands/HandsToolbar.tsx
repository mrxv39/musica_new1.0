/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsToolbar.tsx
export type HandsMode = "OBS" | "REAL";

export default function HandsToolbar({
  mode,
  onChangeMode,

  dbPath,
  onChangeDbPath,
  canLoad,
  onRefresh,
  auto,
  onToggleAuto,
  status,
  busy,
  onReset,
  onRunBatch,

  workersRunning,
  onToggleWorkers,

  stackEfRangeText,
  onChangeStackEfRangeText,
  betRangeText,
  onChangeBetRangeText,
  rangeListText,
  onChangeRangeListText,
  onClearFilters,
}: {
  mode: HandsMode;
  onChangeMode: (m: HandsMode) => void;

  dbPath: string;
  onChangeDbPath: (v: string) => void;
  canLoad: boolean;
  onRefresh: () => void;
  auto: boolean;
  onToggleAuto: (v: boolean) => void;
  status: string;

  busy: boolean;
  onReset: () => void;
  onRunBatch: () => void;

  workersRunning: boolean;
  onToggleWorkers: () => void;

  stackEfRangeText: string;
  onChangeStackEfRangeText: (v: string) => void;

  betRangeText: string;
  onChangeBetRangeText: (v: string) => void;

  rangeListText: string;
  onChangeRangeListText: (v: string) => void;

  onClearFilters: () => void;
}) {
  const isObs = mode === "OBS";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ fontSize: 14 }}>Modo:</label>
      <select
        value={mode}
        onChange={(e) => onChangeMode(e.target.value as HandsMode)}
        disabled={busy}
        style={{ padding: "6px 8px", fontSize: 13 }}
      >
        <option value="OBS">OCR (hands_obs)</option>
        <option value="REAL">XML (hands_real)</option>
      </select>

      <label style={{ fontSize: 14 }}>DB:</label>
      <input
        style={{ width: 520, padding: "6px 8px", fontSize: 13 }}
        value={dbPath}
        onChange={(e) => onChangeDbPath(e.target.value)}
        disabled={busy}
      />

      <button disabled={!canLoad || busy} onClick={onRefresh}>
        Refresh
      </button>

      {isObs ? (
        <>
          <button disabled={!canLoad || busy} onClick={onReset} title="DELETE FROM hands_obs">
            Reset
          </button>

          <button disabled={!canLoad || busy} onClick={onRunBatch} title="Analiza 50 imágenes de la carpeta test_images">
            50 hands
          </button>

          <button
            disabled={!canLoad || busy}
            onClick={onToggleWorkers}
            title="Start/Stop bucle infinito: captura 4 mesas y corre el worker"
          >
            {workersRunning ? "Stop workers" : "Start workers"}
          </button>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => onToggleAuto(e.target.checked)}
              disabled={busy}
            />
            Auto (1.5s)
          </label>
        </>
      ) : (
        <>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => onToggleAuto(e.target.checked)}
              disabled={busy}
            />
            Auto (3s)
          </label>
        </>
      )}

      <span style={{ fontSize: 13, opacity: 0.8 }}>{busy ? "running..." : status}</span>

      {isObs ? (
        <>
          <div style={{ flexBasis: "100%", height: 0 }} />

          <label style={{ fontSize: 13, opacity: 0.9 }}>StackEf (ej: 20-75):</label>
          <input
            style={{ width: 120, padding: "6px 8px", fontSize: 13 }}
            value={stackEfRangeText}
            onChange={(e) => onChangeStackEfRangeText(e.target.value)}
            placeholder="20-75"
            disabled={busy}
          />

          <label style={{ fontSize: 13, opacity: 0.9 }}>Bet (ej: 2-3):</label>
          <input
            style={{ width: 120, padding: "6px 8px", fontSize: 13 }}
            value={betRangeText}
            onChange={(e) => onChangeBetRangeText(e.target.value)}
            placeholder="2-3"
            disabled={busy}
          />

          <label style={{ fontSize: 13, opacity: 0.9 }}>Rango (ej: 33-22,A9o-A2o,...):</label>
          <input
            style={{ width: 520, padding: "6px 8px", fontSize: 13 }}
            value={rangeListText}
            onChange={(e) => onChangeRangeListText(e.target.value)}
            placeholder="33-22,A9o-A2o,KJo-K8o,QJo-Q9o,JTo-J9o,T9o,K9s-K2s,Q9s-Q2s,J9s-J5s,T9s-T6s,98s-96s,87s-86s,76s-75s,65s-64s,54s"
            disabled={busy}
          />

          <button onClick={onClearFilters} disabled={busy} title="Limpia filtros (StackEf, Bet y Rango)">
            Clear filters
          </button>
        </>
      ) : null}
    </div>
  );
}
