/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\app\AppShell.tsx
import TopNav from "../components/TopNav";
import { Tab } from "./tabs";

export default function AppShell({
  activeTab,
  onChangeTab,
  children,
}: {
  activeTab: Tab;
  onChangeTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0, marginBottom: 10 }}>Poker Boss</h2>
      <TopNav activeTab={activeTab} onChange={onChangeTab} />
      <div className="page-content">{children}</div>
    </div>
  );
}
