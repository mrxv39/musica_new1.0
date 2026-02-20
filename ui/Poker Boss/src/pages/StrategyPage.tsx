// ui/Poker Boss/src/pages/StrategyPage.tsx

import { useEffect, useMemo, useState } from "react";
import { ESTRATEGIAS_GLOBALES, StrategyGlobal } from "../strategy/constants";
import { loadStrategyStore, saveStrategyStore, listSubs, upsertSub, deleteSub, ensureGlobal } from "../strategy/store";
import { makeSubId, computeSituacionFromPositions } from "../strategy/utils";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../strategy/types";
import StrategyEditor from "../strategy/components/StrategyEditor";

function defaultPayload(): SubStrategyPayload {
  return {
    spot: "BTN",

    hero_pos: "BTN",
    p1_bet_min: 0,
    p1_bet_max: 75,
    p1_stack_min: 0,
    p1_stack_max: 75,
    p1_se_min: 0,
    p1_se_max: 75,

    p2_pos: "SB",
    p2_tipo: "fish",
    p2_bet_min: 0,
    p2_bet_max: 75,
    p2_stack_min: 0,
    p2_stack_max: 75,

    p3_pos: "BB",
    p3_tipo: "fish",
    p3_bet_min: 0,
    p3_bet_max: 75,
    p3_stack_min: 0,
    p3_stack_max: 75,

    situacion: computeSituacionFromPositions("BTN", "SB", "BB"),
  };
}

export default function StrategyPage() {
  const [store, setStore] = useState<StrategyStore>(() => loadStrategyStore());
  const [globalName, setGlobalName] = useState<StrategyGlobal>("BASE");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [payload, setPayload] = useState<SubStrategyPayload>(() => defaultPayload());
  const [status, setStatus] = useState<string>("");

  const subs = useMemo(() => listSubs(store, globalName), [store, globalName]);

  useEffect(() => {
    const s: StrategyStore = { ...store };
    ensureGlobal(s, globalName);
    setStore(s);
    saveStrategyStore(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedIndex(null);
    setStatus("");
  }, [globalName]);

  const generated = useMemo(() => {
    const p: SubStrategyPayload = { ...payload };
    p.situacion = computeSituacionFromPositions(p.hero_pos, p.p2_pos, p.p3_pos);
    const id = makeSubId(p);
    return { id, payload: p } as SubStrategyItem;
  }, [payload]);

  const onNew = () => {
    setSelectedIndex(null);
    setPayload(defaultPayload());
    setStatus("Nuevo: editor limpio.");
  };

  const onSave = () => {
    const nextStore: StrategyStore = { ...store };
    const idx = upsertSub(nextStore, globalName, generated);
    setStore(nextStore);
    saveStrategyStore(nextStore);
    setSelectedIndex(idx);
    setStatus(`Guardado: ${generated.id}`);
  };

  const onDelete = () => {
    if (selectedIndex === null) {
      setStatus("Selecciona una subestrategia para borrar.");
      return;
    }
    const nextStore: StrategyStore = { ...store };
    deleteSub(nextStore, globalName, selectedIndex);
    setStore(nextStore);
    saveStrategyStore(nextStore);
    setSelectedIndex(null);
    setStatus("Subestrategia borrada.");
  };

  const onSelect = (idx: number) => {
    const item = subs[idx];
    if (!item) return;
    setSelectedIndex(idx);
    setPayload(item.payload);
    setStatus(`Cargado: ${item.id}`);
  };

  const onCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(generated, null, 2));
      setStatus("Copiado al portapapeles (item + payload).");
    } catch {
      setStatus("No pude copiar (permiso). Puedes copiar desde el textarea.");
    }
  };

  const onExportStore = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(store, null, 2));
      setStatus("Copiado al portapapeles (STORE completo).");
    } catch {
      setStatus("No pude copiar el STORE (permiso).");
    }
  };

  const onImportStore = () => {
    const raw = window.prompt("Pega aquí el STORE (JSON) para importar/reescribir:");
    if (raw === null) return;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") throw new Error("JSON inválido");
      const nextStore = obj as StrategyStore;
      setStore(nextStore);
      saveStrategyStore(nextStore);
      setSelectedIndex(null);
      setStatus("Import OK (store reemplazado).");
    } catch (e: any) {
      setStatus(`Import ERROR: ${e?.message || String(e)}`);
    }
  };

  return (
    <div className="strategy-page">
      <div className="strategy-layout">
        <aside className="strategy-sidebar">
          <div className="sb-title">Estrategias</div>

          <div className="sb-field">
            <label>estrategia global</label>
            <select value={globalName} onChange={(e) => setGlobalName(e.target.value as StrategyGlobal)}>
              {ESTRATEGIAS_GLOBALES.map((g: StrategyGlobal) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="sb-field">
            <label>subestrategias</label>
            <div className="sb-list">
              {subs.length === 0 ? (
                <div className="muted">— vacío —</div>
              ) : (
                subs.map((it: SubStrategyItem, idx: number) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`sb-item${selectedIndex === idx ? " active" : ""}`}
                    onClick={() => onSelect(idx)}
                    title={it.id}
                  >
                    {it.id}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="sb-actions">
            <button type="button" onClick={onNew}>
              Nuevo (limpiar)
            </button>
            <button type="button" onClick={onSave}>
              Guardar subestrategia
            </button>
            <button type="button" onClick={onDelete}>
              Borrar subestrategia
            </button>
            <button type="button" onClick={onCopyJson}>
              Copiar JSON (item)
            </button>
            <button type="button" onClick={onExportStore}>
              Copiar STORE
            </button>
            <button type="button" onClick={onImportStore}>
              Import STORE
            </button>
          </div>

          <div className="sb-status">{status || " "}</div>
        </aside>

        <main className="strategy-main">
          <div className="strategy-header">
            <div>
              <div className="strategy-h1">Strategy</div>
              <div className="muted">id generado: {generated.id}</div>
            </div>
          </div>

          <StrategyEditor value={payload} onChange={setPayload} showOrPanel={selectedIndex !== null} />

          <div className="strategy-output">
            <div className="strategy-output-title">Salida (preview)</div>
            <textarea readOnly value={JSON.stringify(generated, null, 2)} />
          </div>
        </main>
      </div>
    </div>
  );
}
