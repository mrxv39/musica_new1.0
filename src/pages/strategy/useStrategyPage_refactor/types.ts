import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type CrudCtx = {
  globalName: string;
  store: StrategyStore;
  subsView: SubStrategyItem[];
  selectedId: string | null;
  editorValue: SubStrategyPayload;
  orRangesRows: OrRangeRow[];

  setStore: SetState<StrategyStore>;
  setSubsView: SetState<SubStrategyItem[]>;
  setSelectedId: SetState<string | null>;
  setError: SetState<string | null>;
  setIsLoading: SetState<boolean>;

  dirtyRef: React.MutableRefObject<boolean>;
};
