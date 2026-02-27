/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsToolbar.tsx
export default function HandsToolbar({
  dbPath,
  onChangeDbPath,
  canLoad,
  onRefresh,
  auto,
  onToggleAuto,
  status,
  busy,
  onReset,
  onRunOne,
  onRunBatch,

  stackEfRangeText,
  onChangeStackEfRangeText,
  betRangeText,
  onChangeBetRangeText,

  rangeListText,
  onChangeRangeListText,

  onClearFilters,
}: {
  dbPath: string;
  onChangeDbPath: (v: string) => void;
  canLoad: boolean;
  onRefresh: () => void;
  auto: boolean;
  onToggleAuto: (v: boolean) => void;
  status: string;

  busy: boolean;
  onReset: () => void;
  onRunOne: () => void;
  onRunBatch: () => void;

  stackEfRangeText: string;
  onChangeStackEfRangeText: (v: string) => void;

  betRangeText: string;
  onChangeBetRangeText: (v: string) => void;

  rangeListText: string;
  onChangeRangeListText: (v: string) => void;

  onClearFilters: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

      <button disabled={!canLoad || busy} onClick={onReset} title="DELETE FROM hands_obs">
        Reset
      </button>

      <button disabled={!canLoad || busy} onClick={onRunOne} title="Analiza 1 imagen (worker --max_ticks 1)">
        1 hand
      </button>

      <button disabled={!canLoad || busy} onClick={onRunBatch} title="Analiza 50 imágenes de la carpeta test_images">
        50 hands
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

      <span style={{ fontSize: 13, opacity: 0.8 }}>{busy ? "running..." : status}</span>

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
    </div>
  );
}
