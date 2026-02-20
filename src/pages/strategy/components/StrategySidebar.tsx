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
  } = props;

  const disabled = !!isLoading;

  return (
    <aside className="strategy-sidebar">
      <div className="sb-title">Estrategia</div>

      <div className="sb-field">
        <label>estrategia global</label>
        <select
          value={globalName}
          onChange={(e) => onChangeGlobal(e.target.value)}
          disabled={disabled}
        >
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
                    {active ? <span className="sb-badge">ACTIVE</span> : null}
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

        <button type="button" onClick={onDuplicate} disabled={disabled}>
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
