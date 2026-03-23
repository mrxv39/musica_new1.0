/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\App.tsx
import { useEffect } from "react";
import "./App.css";
import { initDB } from "./db/sql";
import AppRouter from "./app/AppRouter";

const _appStart = performance.now();

export default function App() {
  useEffect(() => {
    initDB();
    const t = performance.now() - _appStart;
    console.log(`[PERF] App mounted in ${t.toFixed(0)}ms`);
  }, []);

  return <AppRouter />;
}
