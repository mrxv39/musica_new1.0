/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsSort.ts
import { useState } from "react";
import { HandsSortKey } from "./sortHands";

export function useHandsSort() {
  const [sortKey, setSortKey] = useState<HandsSortKey>("detected_at_ms");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const onSort = (key: HandsSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return { sortKey, sortAsc, onSort };
}
