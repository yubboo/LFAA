// 资料库分类标识与校验：从 workbench-service 抽出，控制服务文件体量。
/** 约定资料库分类在工作台中的稳定标识；`media` 为并入资料库的图像分类，`trash` 为统一回收站。 */
export type LibraryTabKey = "all" | "media" | "artifact" | "asset" | "memory" | "trash";

const LIBRARY_TABS: readonly LibraryTabKey[] = ["all", "media", "artifact", "asset", "memory", "trash"];

/** 校验浏览器记忆里的资料库分类，非法值回退到全部。 */
export function isLibraryTabKey(value: unknown): value is LibraryTabKey {
  return typeof value === "string" && (LIBRARY_TABS as readonly string[]).includes(value);
}