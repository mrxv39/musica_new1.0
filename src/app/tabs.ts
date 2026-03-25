/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\app\tabs.ts
export type Tab =
  | "hands"
  | "strategy"
  | "spots"
  | "players"
  | "stats"
  | "account"
  | "import";

export const TOP_TABS: Array<{ key: Tab; label: string }> = [
  { key: "hands", label: "Hands" },
  { key: "strategy", label: "Strategy" },
  { key: "spots", label: "Spots" },
  { key: "players", label: "Players" },
  { key: "stats", label: "Stats" },
  { key: "account", label: "Account" },
  { key: "import", label: "Import" },
];