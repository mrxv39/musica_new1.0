import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { getHandsDefaultDbPath } from "../../config";

type MesaOverlayRow = {
  mesa: number;
  p2_tipo: string | null;
  p3_tipo: string | null;
  p2_name: string | null;
  p3_name: string | null;
};

const TIPO_CYCLE = ["fish", "reg", "unknown"] as const;
type Tipo = (typeof TIPO_CYCLE)[number];

const TIPO_COLORS: Record<Tipo, { bg: string; fg: string }> = {
  fish: { bg: "#28a745", fg: "#fff" },
  reg: { bg: "#dc3545", fg: "#fff" },
  unknown: { bg: "#6c757d", fg: "#fff" },
};

function normTipo(v: string | null | undefined): Tipo {
  const t = (v || "").trim().toLowerCase();
  if (t === "fish") return "fish";
  if (t === "reg") return "reg";
  return "unknown";
}

function TipoButton({ label, name, tipo, onCycle }: {
  label: string;
  name: string;
  tipo: Tipo;
  onCycle: (name: string, next: Tipo) => void;
}) {
  const colors = TIPO_COLORS[tipo];
  return (
    <button
      onClick={() => {
        const idx = TIPO_CYCLE.indexOf(tipo);
        const next = TIPO_CYCLE[(idx + 1) % TIPO_CYCLE.length];
        onCycle(name, next);
      }}
      disabled={!name}
      title={name ? `${name} — click para cambiar tipo` : "Sin jugador detectado"}
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid rgba(0,0,0,0.15)",
        background: colors.bg,
        color: colors.fg,
        fontSize: 11,
        fontWeight: 700,
        cursor: name ? "pointer" : "default",
        opacity: name ? 1 : 0.4,
        minWidth: 70,
      }}
    >
      {label}: {tipo.toUpperCase()}
    </button>
  );
}

export default function MesaTipoBar() {
  const [mesas, setMesas] = React.useState<MesaOverlayRow[]>([]);

  const fetchState = React.useCallback(async () => {
    try {
      const dbPath = getHandsDefaultDbPath();
      const rows = await invoke<MesaOverlayRow[]>("get_mesas_overlay_state", { dbPath });
      if (Array.isArray(rows)) setMesas(rows);
    } catch {}
  }, []);

  React.useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  const handleCycle = React.useCallback(async (name: string, next: Tipo) => {
    if (!name) return;
    try {
      const dbPath = getHandsDefaultDbPath();
      await invoke("update_player_tipo", { dbPath, playerName: name, tipo: next });
      // Refresh immediately
      setTimeout(() => fetchState(), 300);
    } catch (e) {
      console.error("update_player_tipo failed", e);
    }
  }, [fetchState]);

  const activeMesas = mesas.filter(m => m.p2_name || m.p3_name);
  if (activeMesas.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Tipos:</span>
      {activeMesas.map(m => (
        <div key={m.mesa} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.5 }}>M{m.mesa}</span>
          <TipoButton label="P2" name={m.p2_name || ""} tipo={normTipo(m.p2_tipo)} onCycle={handleCycle} />
          <TipoButton label="P3" name={m.p3_name || ""} tipo={normTipo(m.p3_tipo)} onCycle={handleCycle} />
        </div>
      ))}
    </div>
  );
}
