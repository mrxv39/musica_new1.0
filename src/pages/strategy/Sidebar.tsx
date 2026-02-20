/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\Sidebar.tsx
 */
import type { StrategyGlobal } from "../../strategy/constants";
import type { SubStrategyItem } from "../../strategy/types";
import { ESTRATEGIAS_GLOBALES } from "../../strategy/constants";
import { formatSubLabel } from "../../strategy/utils";

export default function Sidebar(props: {
  globalName: StrategyGlobal;
  setGlobalName: (g: StrategyGlobal) => void;
  subs: SubStrategyItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;

  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyJson: () => void;
  onExportStore: () => void;
  onImportStore: () => void;

  status: string;
}) {
  const {
    globalName,
    setGlobalName,
    subs,
    selectedId,
    onSelect,
    onNew,
    onSave,
    onDelete,
    onDuplicate,
    onCopyJson,
    onExportStore,
    onImportStore,
    status,
  } = props;

  return (
    <aside className="strategy-sidebar">
      <div className="sb-title">Estrategias</div>

      <div className="sb-field">
        <label>estrategia global</label>
        <select value={globalName} onChange={(e) => setGlobalName(e.target.value as StrategyGlobal)}>
          {ESTRATEGIAS_GLOBALES.map((g) => (
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
            subs.map((it) => {
              const active = selectedId === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`sb-item${active ? " active" : ""}`}
                  onClick={() => onSelect(it.id)}
                  title={it.id}
                >
                  <div className="sb-item-row">
                    <span className="sb-item-label">{formatSubLabel(it.payload)}</span>
                    {active ? <span className="sb-badge">ACTIVE</span> : null}
                  </div>
                </button>
              );
            })
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
        <button type="button" onClick={onDuplicate}>
          Duplicar subestrategia
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
  );
}
