/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsColumnsConfigModal.tsx
import React from "react";

export type ColumnConfigItem = { id: string; label: string };

type Props = {
  open: boolean;
  columns: ColumnConfigItem[];
  visibleIds: string[];
  onChangeVisibleIds: (next: string[]) => void;
  onClose: () => void;
  storageKey: string;
  title?: string;
};

function uniqStable(xs: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function HandsColumnsConfigModal({
  open,
  columns,
  visibleIds,
  onChangeVisibleIds,
  onClose,
  storageKey,
  title = "Hands – columnas",
}: Props) {
  const allIds = React.useMemo(() => columns.map((c) => c.id), [columns]);
  const visibleSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);

  const toggle = (id: string) => {
    const next = new Set(visibleSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeVisibleIds(allIds.filter((x) => next.has(x)));
  };

  const setAll = () => onChangeVisibleIds(allIds.slice());
  const setNone = () => onChangeVisibleIds([]);
  const resetDefault = () => {
    localStorage.removeItem(storageKey);
    onChangeVisibleIds(allIds.slice());
  };

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 70,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "calc(100vw - 24px)",
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ padding: "6px 10px", cursor: "pointer" }}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={setAll} style={{ padding: "6px 10px", cursor: "pointer" }}>
            Mostrar todas
          </button>
          <button onClick={setNone} style={{ padding: "6px 10px", cursor: "pointer" }}>
            Ocultar todas
          </button>
          <button onClick={resetDefault} style={{ padding: "6px 10px", cursor: "pointer" }}>
            Reset
          </button>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
            Visibles: {uniqStable(visibleIds).length} / {allIds.length}
          </div>
        </div>

        <div style={{ maxHeight: "60vh", overflow: "auto", padding: "0 14px 14px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {columns.map((c) => {
              const checked = visibleSet.has(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  title={c.id}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13 }}>{c.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
