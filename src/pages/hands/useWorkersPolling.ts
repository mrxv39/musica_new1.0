/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useWorkersPolling.ts

import { useEffect, useRef, useState } from "react";
import { getWorkersStatusState } from "./workersClient";

export function useWorkersPolling(intervalMs: number = 500) {
  const [workersRunning, setWorkersRunning] = useState<boolean>(false);
  const [workersStatusText, setWorkersStatusText] = useState<string>("");

  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const pollOnce = async () => {
      try {
        const st = await getWorkersStatusState();
        if (!cancelled) {
          setWorkersRunning(st.running);
          setWorkersStatusText(st.statusText);
        }
      } catch {
        // ignore polling errors
      }
    };

    void pollOnce();

    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
    }

    pollRef.current = window.setInterval(() => {
      void pollOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [intervalMs]);

  return {
    workersRunning,
    setWorkersRunning,
    workersStatusText,
  };
}
