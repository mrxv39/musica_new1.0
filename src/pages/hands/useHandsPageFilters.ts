// /// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useHandsPageFilters.ts

import { useMemo, useState } from "react";
import type { HandsObsRow } from "../../db";
import { filterHandsByAllFilters, parseNumericRange } from "./handsFilters";
import type { LinkFilter } from "./handsFilters";

export type HandsPageFilters = {
  stackEfRangeText: string;
  betRangeText: string;
  rangeListText: string;
  linkFilter: LinkFilter;
  filtered: ReturnType<typeof filterHandsByAllFilters>;
  onChangeStackEfRangeText: (v: string) => void;
  onChangeBetRangeText: (v: string) => void;
  onChangeRangeListText: (v: string) => void;
  onChangeLinkFilter: (v: LinkFilter) => void;
  onClearFilters: () => void;
};

export function useHandsPageFilters(obsRows: HandsObsRow[]): HandsPageFilters {
  const [stackEfRangeText, setStackEfRangeText] = useState<string>(
    () => localStorage.getItem("hands.stackEfRangeText") || ""
  );
  const [betRangeText, setBetRangeText] = useState<string>(
    () => localStorage.getItem("hands.betRangeText") || ""
  );
  const [rangeListText, setRangeListText] = useState<string>(
    () => localStorage.getItem("hands.rangeListText") || ""
  );
  const [linkFilter, setLinkFilter] = useState<LinkFilter>(() => {
    const saved = localStorage.getItem("hands.linkFilter");
    return saved === "linked" || saved === "unlinked" ? saved : "all";
  });

  const stackEfRange = useMemo(() => parseNumericRange(stackEfRangeText), [stackEfRangeText]);
  const betRange = useMemo(() => parseNumericRange(betRangeText), [betRangeText]);

  const filtered = useMemo(
    () => filterHandsByAllFilters(obsRows as HandsObsRow[], stackEfRange, betRange, rangeListText, linkFilter),
    [obsRows, stackEfRange, betRange, rangeListText, linkFilter]
  );

  const onChangeStackEfRangeText = (v: string) => {
    setStackEfRangeText(v);
    localStorage.setItem("hands.stackEfRangeText", v);
  };

  const onChangeBetRangeText = (v: string) => {
    setBetRangeText(v);
    localStorage.setItem("hands.betRangeText", v);
  };

  const onChangeRangeListText = (v: string) => {
    setRangeListText(v);
    localStorage.setItem("hands.rangeListText", v);
  };

  const onChangeLinkFilter = (v: LinkFilter) => {
    setLinkFilter(v);
    localStorage.setItem("hands.linkFilter", v);
  };

  const onClearFilters = () => {
    onChangeStackEfRangeText("");
    onChangeBetRangeText("");
    onChangeRangeListText("");
    onChangeLinkFilter("all");
    localStorage.removeItem("hands.linkFilter");
  };

  return {
    stackEfRangeText,
    betRangeText,
    rangeListText,
    linkFilter,
    filtered,
    onChangeStackEfRangeText,
    onChangeBetRangeText,
    onChangeRangeListText,
    onChangeLinkFilter,
    onClearFilters,
  };
}
