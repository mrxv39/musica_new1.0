/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategySidebar.tsx
 */
import type { SubStrategyItem } from "../state";
import { getUiName } from "../model";

type Props = {
  // global selector
  globalName: string;
  globals: string[];
  onChangeGlobal: (v: string) => void;

  // ui state
  isLoading?: boolean;
  status?: string;

  // list
  subs: SubStrategyItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;

  // actions
  onNew: () => void;
  onDuplicate: () => void;
  onSave: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;

  // delete
  onDelete: (id: string) => void | Promise<void>;
};

export default function StrategySidebar(props: Props) {
  const {
    globalName,
    globals,
    onChangeGlobal,
    isLoading,
    status,
    subs,
    selectedId,
    onSelect,
    onNew,
    onDuplicate,
    onSave,
    onCopy,
    onDelete,
  } = props;

  const disabled = !!isLoading;

  const handleDelete = async (id: string, name: string) => {
    if (disabled) return;

    const ok = window.confirm(`¿Eliminar la subestrategia "${name}"?\n\nEsta acción no se puede deshacer.`);
    if (!ok) return;

    await onDelete(id);
  };

  return (
    <aside className="strategy-sidebar">
      <div className="sb-title">Estrategia</div>

      <div className="sb-field">
        <label>estrategia global</label>
        <select value={globalName} onChange={(e) => onChangeGlobal(e.target.value)} disabled={disabled}>
          {(globals?.length ? globals : [globalName]).map((g) => (
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
            subs.map((s) => {
              const active = s.id === selectedId;
              const name = getUiName(s, s.id);

              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sb-item${active ? " active" : ""}`}
                  onClick={() => onSelect(s.id)}
                  title={s.id}
                  disabled={disabled}
                >
                  <div className="sb-item-row">
                    <span className="sb-item-label">{name}</span>

                    <span className="sb-item-actions">
                      {active ? <span className="sb-badge">ACTIVE</span> : null}

                      <button
                        type="button"
                        className="sb-del"
                        title="Eliminar"
                        aria-label={`Eliminar ${name}`}
                        disabled={disabled}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete(s.id, name);
                        }}
                      >
                        🗑️
                      </button>
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="sb-actions">
        <button type="button" onClick={onNew} disabled={disabled}>
          New
        </button>

        <button type="button" onClick={() => onDuplicate()} disabled={disabled}>
          Duplicate
        </button>

        <button type="button" onClick={onSave} disabled={disabled}>
          Guardar
        </button>

        <button type="button" onClick={onCopy} disabled={disabled}>
          Copy JSON
        </button>
      </div>

      <div className="sb-status">{status || " "}</div>
    </aside>
  );
}