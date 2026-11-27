// 画布资料库拖放标记：仅在浏览器识别内部素材拖拽，文件路径留在编辑器内存中。
const libraryDragType = "application/x-lfaa-canvas-library-item";

/** 标记资料库拖拽，使用复制光标表示保留原素材。 */
export function startLibraryDrag(transfer: DataTransfer): void {
  transfer.effectAllowed = "copy";
  transfer.setData(libraryDragType, "1");
}

/** 在 dragover 时只检查类型，浏览器此时不会暴露拖拽内容。 */
export function isLibraryDrag(transfer: DataTransfer): boolean {
  return transfer.types.includes(libraryDragType);
}
