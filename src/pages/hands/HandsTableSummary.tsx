type Props = {
  shown: number;
  total: number;
  dbPath?: string;
  rangeError?: string;
  batchFolderPath?: string;
  lastLog?: string;
};

export default function HandsTableSummary({
  shown,
  total,
  dbPath,
  rangeError,
  batchFolderPath,
  lastLog,
}: Props) {
  return (
    <>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        Rows: {shown} / {total}
        {dbPath ? ` | DB actual: ${dbPath}` : ""}
      </div>

      {rangeError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#b00020" }}>Rango inválido: {rangeError}</div>
      ) : null}

      {batchFolderPath ? (
        <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>Folder 50-hands: {batchFolderPath}</div>
      ) : null}

      {lastLog ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>
            Ver log completo (stdout/stderr)
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{lastLog}</pre>
        </details>
      ) : null}
    </>
  );
}
