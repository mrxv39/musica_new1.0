/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\StrategyPage.tsx
 */
import { useMemo, useRef, useState } from "react";
import type { StrategyGlobal } from "../strategy/constants";
import { listSubs } from "../strategy/store";
import type { StrategyStore, SubStrategyPayload } from "../strategy/types";
import { normalizePayload, makeSubId, computeSituacionFromPositions } from "../strategy/utils";

import { emptyStore, defaultPayload } from "./strategy/defaults";
import { useStrategyDBLifecycle } from "./strategy/hooks";
import { createStrategyActions } from "./strategy/actions";
import Sidebar from "./strategy/Sidebar";
import Main from "./strategy/Main";

export default function StrategyPage() {
  const [store, setStore] = useState<StrategyStore>(() => emptyStore());
  const [globalName, setGlobalName] = useState<StrategyGlobal>("BASE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payload, setPayload] = useState<SubStrategyPayload>(() => defaultPayload());
  const [status, setStatus] = useState<string>("");

  const { refreshFromDB } = useStrategyDBLifecycle({
    globalName,
    setStore,
    setSelectedId,
    setPayload,
    setStatus,
  });

  // refs para acciones (evita deps infinitas)
  const storeRef = useRef(store);
  const globalRef = useRef(globalName);
  const selectedRef = useRef(selectedId);
  const payloadRef = useRef(payload);

  storeRef.current = store;
  globalRef.current = globalName;
  selectedRef.current = selectedId;
  payloadRef.current = payload;

  const subs = useMemo(() => listSubs(store, globalName), [store, globalName]);

  const generated = useMemo(() => {
    const p0 = normalizePayload(payload);
    const p: SubStrategyPayload = { ...p0 };
    p.situacion = computeSituacionFromPositions(p.hero_pos, p.p2_pos, p.p3_pos);
    return { id: makeSubId(p), payload: p };
  }, [payload]);

  const actions = useMemo(
    () =>
      createStrategyActions({
        getStore: () => storeRef.current,
        setStore,
        getGlobal: () => globalRef.current,
        getSelectedId: () => selectedRef.current,
        setSelectedId,
        getPayload: () => payloadRef.current,
        setPayload,
        setStatus,
        refreshFromDB,
      }),
    [refreshFromDB]
  );

  return (
    <div className="strategy-page">
      <div className="strategy-layout">
        <Sidebar
          globalName={globalName}
          setGlobalName={setGlobalName}
          subs={subs}
          selectedId={selectedId}
          onSelect={actions.onSelect}
          onNew={actions.onNew}
          onSave={actions.onSave}
          onDelete={actions.onDelete}
          onDuplicate={actions.onDuplicate}
          onCopyJson={actions.onCopyJson}
          onExportStore={actions.onExportStore}
          onImportStore={actions.onImportStore}
          status={status}
        />

        <Main payload={payload} generated={generated} onChange={setPayload} />
      </div>
    </div>
  );
}
