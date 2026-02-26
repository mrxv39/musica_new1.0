/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\ImagePreviewModal.tsx
import React from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

type Props = {
  path: string;
  onClose: () => void;
};

export function ImagePreviewModal({ path, onClose }: Props) {
  const src = React.useMemo(() => {
    const p = (path || "").trim();
    if (!p) return "";
    try {
      return convertFileSrc(p);
    } catch {
      return "";
    }
  }, [path]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!path) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: "92vw",
          maxHeight: "92vh",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {path}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #ddd",
              background: "#f7f7f7",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        <div
          style={{
            padding: 12,
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {src ? (
            <img
              src={src}
              alt="preview"
              style={{
                maxWidth: "88vw",
                maxHeight: "80vh",
                objectFit: "contain",
                background: "#111",
              }}
              onError={(e) => {
                // fallback visual: si no carga, muestra texto
                console.error("img load error", e);
              }}
            />
          ) : (
            <div style={{ color: "#fff" }}>No se pudo convertir la ruta.</div>
          )}
        </div>
      </div>
    </div>
  );
}
