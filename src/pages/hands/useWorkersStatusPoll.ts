// /// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useWorkersStatusPoll.ts

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useWorkersStatusPoll(workersRunning: boolean, setLastLog: (s: string) => void) {
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (workersRunning) {
      if (pollRef.current == null) {
        pollRef.current = window.setInterval(async () => {
          try {
            const s = await invoke<string>("get_workers_status");
            if (s) setLastLog(String(s));
          } catch {
            // ignore
          }
        }, 700);
      }
    } else {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {};
  }, [workersRunning, setLastLog]);
}