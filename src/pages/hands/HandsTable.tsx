/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\HandsTable.tsx
import { HandsObsRow } from "../../db";
import { HandsSortKey } from "./sortHands";
import { HANDS_COLUMNS } from "./handsColumns";

export default function HandsTable({
  rows,
  onSort,
}: {
  rows: HandsObsRow[];
  onSort: (k: HandsSortKey) => void;
}) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: 12,
        fontSize: 13,
      }}
    >
      <thead>
        <tr
          style={{
            textAlign: "left",
            borderBottom: "1px solid #ddd",
          }}
        >
          {HANDS_COLUMNS.map((c) => {
            const clickable = Boolean(c.sortableKey);
            return (
              <th
                key={c.id}
                style={{ cursor: clickable ? "pointer" : "default" }}
                onClick={() => {
                  if (c.sortableKey) onSort(c.sortableKey);
                }}
              >
                {c.label}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
            {HANDS_COLUMNS.map((c) => (
              <td key={c.id} style={{ padding: "6px" }}>
                {c.render(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
