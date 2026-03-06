import HandsToolbarCommon from "./HandsToolbarCommon";
import HandsToolbarObs from "./HandsToolbarObs";

export type HandsMode = "OBS" | "REAL";

type HandsToolbarProps = {
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
};

export default function HandsToolbar(props: HandsToolbarProps) {
  const isObs = props.mode === "OBS";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <HandsToolbarCommon
        mode={props.mode}
        onChangeMode={props.onChangeMode}
        dbPath={props.dbPath}
        onChangeDbPath={props.onChangeDbPath}
        canLoad={props.canLoad}
        onRefresh={props.onRefresh}
        auto={props.auto}
        onToggleAuto={props.onToggleAuto}
        status={props.status}
        busy={props.busy}
        onReset={props.onReset}
        isObs={isObs}
      />

      {isObs ? (
        <HandsToolbarObs
          canLoad={props.canLoad}
          busy={props.busy}
          onRunBatch={props.onRunBatch}
          workersRunning={props.workersRunning}
          onToggleWorkers={props.onToggleWorkers}
          stackEfRangeText={props.stackEfRangeText}
          onChangeStackEfRangeText={props.onChangeStackEfRangeText}
          betRangeText={props.betRangeText}
          onChangeBetRangeText={props.onChangeBetRangeText}
          rangeListText={props.rangeListText}
          onChangeRangeListText={props.onChangeRangeListText}
          onClearFilters={props.onClearFilters}
        />
      ) : null}
    </div>
  );
}
