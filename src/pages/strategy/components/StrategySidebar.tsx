/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategySidebar.tsx
 */
import React from "react";
import type { SubStrategyItem } from "../state";

type Props = {
  subs: SubStrategyItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export default function StrategySidebar({ subs, selectedId, onSelect }: Props) {
  return (
    <aside className="strategy-sidebar">
      <div className="strategy-sidebar__title">Subestrategias</div>

      <div className="strategy-sidebar__list">
        {subs.length === 0 ? (
          <div className="strategy-sidebar__empty">No hay subestrategias.</div>
        ) : (
          subs.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                className={`strategy-sidebar__item ${active ? "is-active" : ""}`}
                onClick={() => onSelect(s.id)}
                title={s.id}
              >
                <div className="strategy-sidebar__itemName">{s.name}</div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
