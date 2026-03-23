/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\RealHandsImageModal.tsx
import React from "react";
import { invoke } from "@tauri-apps/api/core";

export default function RealHandsImageModal({
  open,
  title,
  imagePath,
  onClose,
}: {
  open: boolean;
  title: string;
  imagePath: string;
  onClose: () => void;
}) {
  const [src, setSrc] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    if (!open || !imagePath) {
      setSrc("");
      setError("");
      return;
    }

    setSrc("");
    setError("loading...");

    invoke<string>("read_image_base64", { path: imagePath })
      .then((b64) => {
        if (cancelled) return;
        setSrc(`data:image/png;base64,${b64}`);
        setError("");
      })
      .catch((e) => {
        if (cancelled) return;
        setSrc("");
        setError(String((e as any)?.message || e || "error loading image"));
      });

    return () => {
      cancelled = true;
    };
  }, [open, imagePath]);

  if (!open) return null;

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
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 95vw)",
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          overflow: "hidden",
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
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>

          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 12, overflow: "auto", background: "#fafafa" }}>
          {src ? (
            <img
              src={src}
              alt={title}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
              }}
            />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {error || "No image path."}
            </div>
          )}

          {imagePath ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, wordBreak: "break-all" }}>
              {imagePath}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
