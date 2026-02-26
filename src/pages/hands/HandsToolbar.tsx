/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsToolbar.tsx
export default function HandsToolbar({
  dbPath,
  onChangeDbPath,
  canLoad,
  onRefresh,
  auto,
  onToggleAuto,
  status,
}: {
  dbPath: string;
  onChangeDbPath: (v: string) => void;
  canLoad: boolean;
  onRefresh: () => void;
  auto: boolean;
  onToggleAuto: (v: boolean) => void;
  status: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ fontSize: 14 }}>DB:</label>
      <input
        style={{ width: 520, padding: "6px 8px", fontSize: 13 }}
        value={dbPath}
        onChange={(e) => onChangeDbPath(e.target.value)}
      />
      <button disabled={!canLoad} onClick={onRefresh}>
        Refresh
      </button>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={auto} onChange={(e) => onToggleAuto(e.target.checked)} />
        Auto (1.5s)
      </label>

      <span style={{ fontSize: 13, opacity: 0.8 }}>{status}</span>
    </div>
  );
}
