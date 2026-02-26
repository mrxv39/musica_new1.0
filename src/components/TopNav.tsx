/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\components\TopNav.tsx
import { TOP_TABS, Tab } from "../app/tabs";

export default function TopNav({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="top-nav">
      {TOP_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={"top-nav-tab" + (activeTab === t.key ? " active" : "")}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
