// 输入框交互 Hook：随内容自动增高，并把粘贴/拖入的图片、文件与绝对路径转成附件。
import { useCallback, useEffect, useState } from "react";
import type { ComposerAttachment } from "./composer-context";
import { filesToAttachments, pathToAttachment } from "./composer-attachments";
import { matchAbsolutePath } from "./composer-paths";

/** 样式层是否已用 CSS field-sizing 接管自适应高度：支持时不再逐字测量，彻底避免强制重排。 */
const SUPPORTS_FIELD_SIZING = (() => {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  try {
    return CSS.supports("field-sizing", "content");
  } catch {
    return false;
  }
})();

/** 输入框高度随内容变化：优先交给 CSS field-sizing，其余浏览器用逐帧测量兜底。 */
export function useComposerAutoGrow(
  textareaRef: { current: HTMLTextAreaElement | null },
  draft: string,
): void {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (SUPPORTS_FIELD_SIZING) {
      // 支持 field-sizing 时高度由浏览器按内容算：只声明一次，不再逐字读写 scrollHeight 触发强制重排。
      el.style.setProperty("field-sizing", "content");
      el.style.setProperty("overflow-y", "auto");
      el.style.removeProperty("height");
      return;
    }
    // 合并到下一帧：同一帧内的多次输入只做一次「写高度 → 读 scrollHeight」，避免每个按键都让整页重排。
    const frame = requestAnimationFrame(() => {
      const maxHeight = Number.parseFloat(getComputedStyle(el).maxHeight) || 160;
      el.style.height = "auto";
      const contentHeight = el.scrollHeight;
      el.style.height = `${Math.min(contentHeight, maxHeight)}px`;
      el.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    });
    return () => cancelAnimationFrame(frame);
  }, [draft, textareaRef]);
}

/** 粘贴/拖拽上传：图片与文件入库为附件，整段绝对路径转成本地文件上下文。 */
export function useComposerAttachInput({
  sessionId,
  appendAttachments,
}: {
  sessionId: string;
  appendAttachments: (items: ComposerAttachment[]) => void;
}) {
  const [draggingFiles, setDraggingFiles] = useState(false);

  const attachFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    void filesToAttachments(files, sessionId).then((items) => {
      if (items.length > 0) appendAttachments(items);
    });
  }, [appendAttachments, sessionId]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      attachFiles(files);
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (!text.trim() || matchAbsolutePath(text) !== text.trim()) return;
    const attachment = pathToAttachment(text);
    if (attachment) {
      event.preventDefault();
      appendAttachments([attachment]);
    }
  }, [appendAttachments, attachFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      attachFiles(files);
      return;
    }
    const text = event.dataTransfer.getData("text/plain");
    const attachment = text.trim() ? pathToAttachment(text) : undefined;
    if (attachment) appendAttachments([attachment]);
  }, [appendAttachments, attachFiles]);

  return { draggingFiles, setDraggingFiles, handlePaste, handleDrop };
}