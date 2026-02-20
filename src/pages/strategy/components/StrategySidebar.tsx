/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\components\StrategySidebar.tsx
 */
import type { SubStrategyItem } from "../state";
import { getUiName } from "../model";

export default function StrategySidebar(props: {
  subs: SubStrategyItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { subs, selectedId, onSelect } = props;

  return (
    <aside className="strategy-sidebar">
      <div className="strategy-sidebar__title">Subestrategias</div>

      <div className="strategy-sidebar__list">
        {subs.map((s) => {
          const active = s.id === selectedId;
          const name = getUiName(s, s.id);

          return (
            <button
              key={s.id}
              type="button"
              className={`strategy-sidebar__item ${active ? "is-active" : ""}`}
              onClick={() => onSelect(s.id)}
              title={s.id}
            >
              {name}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
