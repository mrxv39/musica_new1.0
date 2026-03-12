import type { HandsMode } from "./HandsToolbar";

type HandsToolbarCommonProps = {
  mode: HandsMode;
  onChangeMode: (m: HandsMode) => void;
  canLoad: boolean;
  onRefresh: () => void;
  auto: boolean;
  onToggleAuto: (v: boolean) => void;
  status: string;
  busy: boolean;
  onReset: () => void;
  isObs: boolean;
};

export default function HandsToolbarCommon({
  mode,
  onChangeMode,
  canLoad,
  onRefresh,
  auto,
  onToggleAuto,
  status,
  busy,
  onReset,
  isObs,
}: HandsToolbarCommonProps) {
  return (
    <>
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

      <button disabled={!canLoad || busy} onClick={onRefresh}>
        Refresh
      </button>

      <button
        disabled={!canLoad || busy}
        onClick={onReset}
        title={isObs ? "DELETE FROM hands_obs" : "DELETE FROM hands_real"}
      >
        Reset
      </button>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={auto} onChange={(e) => onToggleAuto(e.target.checked)} disabled={busy} />
        {isObs ? "Auto (1.5s)" : "Auto (3s)"}
      </label>

      <span style={{ fontSize: 13, opacity: 0.8 }}>{busy ? "running..." : status}</span>
    </>
  );
}
