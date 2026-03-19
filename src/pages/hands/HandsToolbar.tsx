export type HandsMode = "OBS" | "REAL";

type HandsToolbarProps = {
  canLoad: boolean;
  onRefresh: () => void;
  auto: boolean;
  onToggleAuto: (v: boolean) => void;
  status: string;
  busy: boolean;
  onReset: () => void;
};

export default function HandsToolbar(props: HandsToolbarProps) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button disabled={!props.canLoad || props.busy} onClick={props.onRefresh}>
        Refresh
      </button>

      <button
        disabled={!props.canLoad || props.busy}
        onClick={props.onReset}
        title="DELETE FROM hands_real"
      >
        Reset
      </button>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={props.auto}
          onChange={(e) => props.onToggleAuto(e.target.checked)}
          disabled={props.busy}
        />
        Auto (3s)
      </label>

      <span style={{ fontSize: 13, opacity: 0.8 }}>{props.busy ? "running..." : props.status}</span>
    </div>
  );
}
