/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.types.ts
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";

export type UseStrategyPageParams = {
  globalName: string;
};

export type UseStrategyPageResult = {
  store: StrategyStore;
  subs: SubStrategyItem[];

  selectedId: string | null;
  selectedItem: SubStrategyItem | null;

  editorValue: SubStrategyPayload;
  setEditorValue: (v: SubStrategyPayload) => void;

  isLoading: boolean;
  error: string | null;

  reload: () => Promise<void>;
  setSelectedId: (id: string | null) => void;

  createNew: () => void;
  duplicateSelected: () => void;

  saveSelected: () => Promise<void>;

  copyPayloadJson: () => Promise<void>;
  exportGlobalJson: () => void;
  importGlobalJsonText: (jsonText: string) => Promise<void>;
};
