/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\components\JsonModal.tsx
 */

export function JsonModal({
  open,
  onClose,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  payload: any;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: 20,
          maxWidth: "800px",
          maxHeight: "80%",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Strategy JSON</h3>
        <pre style={{ fontSize: 12 }}>{JSON.stringify(payload, null, 2)}</pre>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}