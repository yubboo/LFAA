// 输入框交互 Hook：随内容自动增高，并把粘贴/拖入的图片、文件与绝对路径转成附件。
import { useCallback, useEffect, useState } from "react";
import type { ComposerAttachment } from "./composer-context";
import { filesToAttachments, pathToAttachment } from "./composer-attachments";
import { matchAbsolutePath } from "./composer-paths";

/** 输入框高度随内容变化：Shift+Enter 换行后跟着长高，超过 max-height 才内部滚动。 */
export function useComposerAutoGrow(
  textareaRef: { current: HTMLTextAreaElement | null },
  draft: string,
): void {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = parseFloat(getComputedStyle(el).maxHeight) || 160;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
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