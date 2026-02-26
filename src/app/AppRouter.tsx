/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\app\AppRouter.tsx
import { useState } from "react";
import StrategyPage from "../pages/StrategyPage";
import HandsPage from "../pages/HandsPage";
import ComingSoon from "../components/ComingSoon";
import AppShell from "./AppShell";
import { Tab } from "./tabs";

export default function AppRouter() {
  const [activeTab, setActiveTab] = useState<Tab>("hands");

  return (
    <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
      {activeTab === "hands" && <HandsPage />}
      {activeTab === "strategy" && <StrategyPage />}
      {activeTab === "account" && <ComingSoon title="Account" />}
      {activeTab === "import" && <ComingSoon title="Import" />}
    </AppShell>
  );
}
