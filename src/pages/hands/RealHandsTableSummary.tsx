type Props = {
  rowsCount: number;
  dbPath: string;
};

export default function RealHandsTableSummary({ rowsCount, dbPath }: Props) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
      Rows: {rowsCount} | DB actual: {dbPath}
    </div>
  );
}
