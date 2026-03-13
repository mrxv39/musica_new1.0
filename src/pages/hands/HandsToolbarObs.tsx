type HandsToolbarObsProps = {
  canLoad: boolean;
  busy: boolean;
  onRunBatch: () => void;
  workersRunning: boolean;
  onToggleWorkers: () => void;
  stackEfRangeText: string;
  onChangeStackEfRangeText: (v: string) => void;
  betRangeText: string;
  onChangeBetRangeText: (v: string) => void;
  rangeListText: string;
  onChangeRangeListText: (v: string) => void;
  linkFilter: "all" | "linked" | "unlinked";
  onChangeLinkFilter: (v: "all" | "linked" | "unlinked") => void;
  onClearFilters: () => void;
};

export default function HandsToolbarObs({
  canLoad,
  busy,
  onRunBatch,
  workersRunning,
  onToggleWorkers,
  stackEfRangeText,
  onChangeStackEfRangeText,
  betRangeText,
  onChangeBetRangeText,
  rangeListText,
  onChangeRangeListText,
  linkFilter,
  onChangeLinkFilter,
  onClearFilters,
}: HandsToolbarObsProps) {
  return (
    <>
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

      <label style={{ fontSize: 13, opacity: 0.9 }}>Enlace:</label>
      <select
        style={{ width: 140, padding: "6px 8px", fontSize: 13 }}
        value={linkFilter}
        onChange={(e) => onChangeLinkFilter(e.target.value as "all" | "linked" | "unlinked")}
        disabled={busy}
      >
        <option value="all">Todas</option>
        <option value="linked">Enlazadas</option>
        <option value="unlinked">No enlazadas</option>
      </select>

      <button onClick={onClearFilters} disabled={busy} title="Limpia filtros (StackEf, Bet, Rango y Enlace)">
        Clear filters
      </button>
    </>
  );
}
