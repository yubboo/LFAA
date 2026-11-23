// 订阅资料库共享状态的 React 入口：中心页与右栏检视器使用同一份选中项与素材列表。
import { useSyncExternalStore } from "react";
import {
  libraryMediaStore,
  librarySelectionStore,
  type LibraryMediaState,
  type LibrarySelection,
} from "./library-store";

/** 订阅当前选中的资料库条目。 */
export function useLibrarySelection(): LibrarySelection {
  return useSyncExternalStore(librarySelectionStore.subscribe, librarySelectionStore.getSnapshot, librarySelectionStore.getSnapshot);
}

/** 订阅生成素材列表的加载与错误状态。 */
export function useLibraryMedia(): LibraryMediaState {
  return useSyncExternalStore(libraryMediaStore.subscribe, libraryMediaStore.getSnapshot, libraryMediaStore.getSnapshot);
}