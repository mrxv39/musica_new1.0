import type { HandsObsRow } from "../../db";

type VisibleColumn = {
  id: string;
  render: (row: HandsObsRow) => React.ReactNode;
};

type Props = {
  rows: HandsObsRow[];
  visibleColumns: VisibleColumn[];
};

export default function HandsTableBody({ rows, visibleColumns }: Props) {
  return (
    <tbody>
      {rows.map((r, i) => (
        <tr key={(r as any).obs_id ?? i} style={{ borderBottom: "1px solid #f0f0f0" }}>
          {visibleColumns.map((c) => (
            <td key={c.id} style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              {c.render(r)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
