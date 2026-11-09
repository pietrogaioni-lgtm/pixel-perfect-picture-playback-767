import { useSyncExternalStore } from "react";
import { defaultSave, getSaveStore, type SaveData } from "./save";

const serverSnapshot = defaultSave();

export function useSave(): SaveData {
  const store = getSaveStore();
  return useSyncExternalStore(store.subscribe, store.get, () => serverSnapshot);
}
