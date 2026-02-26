/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\App.tsx
import { useEffect } from "react";
import "./App.css";
import { initDB } from "./db/sql";
import AppRouter from "./app/AppRouter";

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return <AppRouter />;
}
