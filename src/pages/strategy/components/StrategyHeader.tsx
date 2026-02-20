/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategyHeader.tsx
 */
type Props = {
  globalName: string;
  globals: string[];
  onChangeGlobal: (v: string) => void;

  // UI status (opcionales porque el header puede vivir sin ellos)
  isLoading?: boolean;
  error?: string | null;

  onNew: () => void;
  onDuplicate: () => void;
  onSave: () => void | Promise<void>;

  onCopy: () => void | Promise<void>;
  onExport: () => void;
  onImportClick: () => void;
};

export default function StrategyHeader(props: Props) {
  const {
    globalName,
    globals,
    onChangeGlobal,
    isLoading,
    error,
    onNew,
    onDuplicate,
    onSave,
    onCopy,
    onExport,
    onImportClick,
  } = props;

  const disabled = !!isLoading;

  return (
    <div className="strategy-header">
      <div className="strategy-header__left">
        <label className="strategy-header__label">
          Global:
          <select
            className="strategy-header__select"
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
        </label>

        {error ? (
          <div style={{ marginLeft: 10, fontSize: 12, opacity: 0.85 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="strategy-header__actions">
        <button className="strategy-btn" onClick={onNew} type="button" disabled={disabled}>
          New
        </button>

        <button className="strategy-btn" onClick={onDuplicate} type="button" disabled={disabled}>
          Duplicate
        </button>

        <button
          className="strategy-btn strategy-btn--primary"
          onClick={onSave}
          type="button"
          disabled={disabled}
        >
          Guardar subestrategia
        </button>

        <button className="strategy-btn" onClick={onCopy} type="button" disabled={disabled}>
          Copy JSON
        </button>

        <button className="strategy-btn" onClick={onExport} type="button" disabled={disabled}>
          Export
        </button>

        <button className="strategy-btn" onClick={onImportClick} type="button" disabled={disabled}>
          Import
        </button>
      </div>
    </div>
  );
}
