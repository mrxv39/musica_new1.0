type Props = {
  rowsCount: number;
};

export default function RealHandsTableSummary({ rowsCount }: Props) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
      Rows: {rowsCount}
    </div>
  );
}
