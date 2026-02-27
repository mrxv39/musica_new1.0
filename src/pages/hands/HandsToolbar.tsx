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
    </div>
  );
}
