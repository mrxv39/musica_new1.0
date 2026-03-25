import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type BugReportResult = {
  dir: string;
  images: string[];
  note_path: string;
};

/**
 * Barra de bug report: captura mesas + nota rápida.
 * Los screenshots se guardan en data/bug_reports/<timestamp>/
 */
export default function BugReportBar() {
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const capture = async (mesas: number[]) => {
    setBusy(true);
    setLastResult(null);
    try {
      const result = await invoke<BugReportResult>("capture_bug_report", {
        req: { mesas, note: note.trim() },
      });
      setLastResult(`${result.images.length} capturas -> ${result.dir.split("\\").pop()}`);
      setNote("");
      setNoteOpen(false);
    } catch (e: any) {
      setLastResult(`Error: ${String(e).slice(0, 120)}`);
    } finally {
      setBusy(false);
    }
  };

  const btnStyle = {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #e67e22",
    background: "#fef3e2",
    color: "#c0392b",
    fontSize: 11,
    cursor: busy ? "not-allowed" : ("pointer" as const),
    fontWeight: 600 as const,
    opacity: busy ? 0.5 : 1,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#c0392b" }}>Bug:</span>
      <button
        style={btnStyle}
        disabled={busy}
        onClick={() => capture([1, 2, 3, 4])}
        title="Captura las 4 mesas y guarda en data/bug_reports/"
      >
        4 mesas
      </button>
      {[1, 2, 3, 4].map((m) => (
        <button
          key={m}
          style={{ ...btnStyle, fontSize: 10, padding: "3px 7px" }}
          disabled={busy}
          onClick={() => capture([m])}
          title={`Captura mesa ${m}`}
        >
          M{m}
        </button>
      ))}
      <button
        style={{
          ...btnStyle,
          background: noteOpen ? "#ffeaa7" : "#fff",
          border: noteOpen ? "2px solid #f39c12" : "1px solid #ccc",
          color: "#333",
        }}
        onClick={() => setNoteOpen(!noteOpen)}
        title="Agregar nota al bug report"
      >
        {noteOpen ? "x" : "Nota"}
      </button>
      {noteOpen && (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Descripcion del bug..."
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #f39c12",
            borderRadius: 6,
            minWidth: 200,
            flexGrow: 1,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && note.trim()) capture([1, 2, 3, 4]);
          }}
        />
      )}
      {lastResult && (
        <span style={{ fontSize: 10, color: lastResult.startsWith("Error") ? "#e74c3c" : "#27ae60" }}>
          {lastResult}
        </span>
      )}
    </div>
  );
}
