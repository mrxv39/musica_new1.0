import React from "react";

export type HandsVisibleBlocks = {
  tournaments: boolean;
  hands: boolean;
  spots: boolean;
  players: boolean;
  workerProfile: boolean;
};

type Props = {
  open: boolean;
  visibleBlocks: HandsVisibleBlocks;
  onChangeVisibleBlocks: (next: HandsVisibleBlocks) => void;
  onClose: () => void;
};

const STORAGE_KEY = "hands.visibleBlocks";

const ALL_KEYS: (keyof HandsVisibleBlocks)[] = [
  "tournaments",
  "hands",
  "spots",
  "players",
  "workerProfile",
];

const LABELS: Record<keyof HandsVisibleBlocks, string> = {
  tournaments: "Tournaments",
  hands: "Hands",
  spots: "Spots",
  players: "Players",
  workerProfile: "Worker profile",
};

export function loadInitialVisibleBlocks(): HandsVisibleBlocks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HandsVisibleBlocks>;
      return {
        tournaments: parsed.tournaments !== false,
        hands:       parsed.hands       !== false,
        spots:       parsed.spots       !== false,
        players:     parsed.players     !== false,
        workerProfile: parsed.workerProfile !== false,
      };
    }
  } catch {
    // ignore
  }
  return {
    tournaments: true,
    hands: true,
    spots: true,
    players: true,
    workerProfile: true,
  };
}

export function persistVisibleBlocks(next: HandsVisibleBlocks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function HandsBlocksConfigModal({ open, visibleBlocks, onChangeVisibleBlocks, onClose }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key: keyof HandsVisibleBlocks) => {
    const next: HandsVisibleBlocks = { ...visibleBlocks, [key]: !visibleBlocks[key] };
    persistVisibleBlocks(next);
    onChangeVisibleBlocks(next);
  };

  const setAll = () => {
    const next: HandsVisibleBlocks = {
      tournaments: true,
      hands: true,
      spots: true,
      players: true,
      workerProfile: true,
    };
    persistVisibleBlocks(next);
    onChangeVisibleBlocks(next);
  };

  const setNone = () => {
    const next: HandsVisibleBlocks = {
      tournaments: false,
      hands: false,
      spots: false,
      players: false,
      workerProfile: false,
    };
    persistVisibleBlocks(next);
    onChangeVisibleBlocks(next);
  };

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
          width: 420,
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
          <div style={{ fontWeight: 700 }}>Hands – tablas visibles</div>
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
        </div>

        <div style={{ maxHeight: "60vh", overflow: "auto", padding: "0 14px 14px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {ALL_KEYS.map((key) => {
              const checked = !!visibleBlocks[key];
              return (
                <label
                  key={key}
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
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13 }}>{LABELS[key]}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

