import { useCallback, useState } from "react";
import { getErrorMessage, uploadAttachment } from "lfaa-client-connection/src/api.js";

export interface PendingComposerAttachment {
  id: string;
  name: string;
  mediaType: string;
  bytes: number;
}

export function useComposerAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<PendingComposerAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const pickAttachments = useCallback(async (files: FileList | File[] | null): Promise<void> => {
    if (!files || attachmentBusy) return;
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"];
    const remaining = 4 - pendingAttachments.length;
    const list = Array.from(files).filter(file => allowed.includes(file.type)).slice(0, Math.max(0, remaining));
    if (list.length === 0) {
      setAttachmentError("只支持 PNG/JPEG/GIF/WebP 图片或纯文本，且最多 4 个附件。");
      return;
    }

    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      for (const file of list) {
        if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error(file.name + " 超过 8 MiB 上限。");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        const uploaded = await uploadAttachment({ name: file.name, mediaType: file.type, dataBase64: btoa(binary) });
        setPendingAttachments(current => [...current, uploaded.attachment]);
      }
    } catch (error) {
      setAttachmentError(getErrorMessage(error));
    } finally {
      setAttachmentBusy(false);
    }
  }, [attachmentBusy, pendingAttachments.length]);

  const removePendingAttachment = useCallback((id: string): void => {
    setPendingAttachments(current => current.filter(item => item.id !== id));
  }, []);

  const takePendingAttachments = useCallback((): PendingComposerAttachment[] => {
    const sending = pendingAttachments;
    if (sending.length > 0) setPendingAttachments([]);
    return sending;
  }, [pendingAttachments]);

  return {
    pendingAttachments,
    attachmentBusy,
    attachmentError,
    pickAttachments,
    removePendingAttachment,
    takePendingAttachments
  };
}
