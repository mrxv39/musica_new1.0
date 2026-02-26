/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { useMemo } from "react";
import HandsToolbar from "./hands/HandsToolbar";
import HandsTable from "./hands/HandsTable";
import { useHandsObs } from "./hands/useHandsObs";
import { sortHands } from "./hands/sortHands";
import { useHandsSort } from "./hands/useHandsSort";

export default function HandsPage() {
  const { dbPath, setDbPath, rows, status, auto, setAuto, canLoad, loadOnce } = useHandsObs();
  const { sortKey, sortAsc, onSort } = useHandsSort();

  const sortedRows = useMemo(() => sortHands(rows, sortKey, sortAsc), [rows, sortKey, sortAsc]);

  return (
    <>
      <HandsToolbar
        dbPath={dbPath}
        onChangeDbPath={setDbPath}
        canLoad={canLoad}
        onRefresh={loadOnce}
        auto={auto}
        onToggleAuto={setAuto}
        status={status}
      />

      <HandsTable rows={sortedRows} onSort={onSort} />

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        DB actual: {dbPath.trim()}
      </div>
    </>
  );
}
