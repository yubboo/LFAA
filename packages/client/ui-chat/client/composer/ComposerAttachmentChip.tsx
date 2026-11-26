// 聊天输入附件：图片显示可点击查看大图的缩略图（右键可复制 / 另存为 / 移除），其他附件保留文件标签。
import { useEffect, useState } from "react";
import { IconCopy, IconDownload, IconPhotoSearch, IconX } from "@tabler/icons-react";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "@lfaa/ui-primitives/client";
import type { ChatLocaleMessages } from "../locales";
import type { ComposerAttachment } from "./composer-context";
import { ComposerImagePreview } from "./ComposerImagePreview";
import { copyImageBlob, downloadImage } from "./composer-image-actions";
import styles from "../conversation/ChatWorkspace.attachments.module.css";

/** 组件卸载时释放本地图片 URL，并中止尚未完成的引用预览请求。 */
export function ComposerAttachmentChip({
  item,
  locale,
  onRemove,
  onNotify,
}: {
  item: ComposerAttachment;
  locale: ChatLocaleMessages;
  onRemove: () => void;
  onNotify: (message: string) => void;
}) {
  const [preview, setPreview] = useState<string>();
  const [blob, setBlob] = useState<Blob>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const source = item.mediaSource?.url;
  const imageFile = item.imageFile;

  useEffect(() => {
    if (!source && !imageFile) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const show = (file: Blob) => {
      if (controller.signal.aborted || !file.type.startsWith("image/")) return;
      objectUrl = URL.createObjectURL(file);
      setBlob(file);
      setPreview(objectUrl);
    };
    if (imageFile) show(imageFile);
    else if (source) {
      void fetch(source, { signal: controller.signal }).then((response) => response.ok ? response.blob() : null)
        .then((file) => { if (file) show(file); })
        .catch(() => { /* 引用文件不可预览时继续显示其名称。 */ });
    }
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile, source]);

  /** 复制缩略图原图到系统剪贴板；不支持时提示改用另存为。 */
  const copyImage = async () => {
    if (!blob) return;
    onNotify(await copyImageBlob(blob) ? locale.attachmentCopyImageDone : locale.attachmentCopyImageFailed);
  };

  /** 用 blob 地址触发浏览器另存为。 */
  const saveImage = () => {
    if (!preview) return;
    downloadImage(preview, item.label, blob?.type);
  };

  if (!preview) {
    return (
      <span className={styles.attachmentChip} title={item.path ?? item.label} data-kind={item.path ? "path" : undefined}>
        <span className={styles.attachmentChipLabel}>{item.label}</span>
        {item.detail && <span className={styles.attachmentChipDetail}>{item.detail}</span>}
        <button
          type="button"
          className={styles.attachmentChipRemove}
          aria-label={`${locale.attachmentRemove} ${item.label}`}
          onClick={onRemove}
        >
          <IconX size={11} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <>
      <span className={styles.attachmentChip} title={item.path ?? item.label} data-kind="image">
        <ContextMenu
          trigger={(
            <button
              type="button"
              className={styles.attachmentThumb}
              aria-label={`${locale.attachmentOpenPreview} ${item.label}`}
              title={locale.attachmentOpenPreview}
              onClick={() => setPreviewOpen(true)}
            >
              <img className={styles.attachmentPreview} src={preview} alt={item.label} draggable={false} />
            </button>
          )}
        >
          <ContextMenuItem icon={<IconPhotoSearch size={14} />} label={locale.attachmentOpenPreview} onClick={() => setPreviewOpen(true)} />
          <ContextMenuItem icon={<IconCopy size={14} />} label={locale.attachmentCopyImage} onClick={() => void copyImage()} />
          <ContextMenuItem icon={<IconDownload size={14} />} label={locale.attachmentSaveImage} onClick={saveImage} />
          <ContextMenuSeparator />
          <ContextMenuItem icon={<IconX size={14} />} label={locale.attachmentRemove} danger onClick={onRemove} />
        </ContextMenu>
        <button
          type="button"
          className={styles.attachmentChipRemove}
          aria-label={`${locale.attachmentRemove} ${item.label}`}
          onClick={onRemove}
        >
          <IconX size={11} aria-hidden="true" />
        </button>
      </span>
      {previewOpen && (
        <ComposerImagePreview
          src={preview}
          label={item.label}
          locale={locale}
          onCopy={() => void copyImage()}
          onSave={saveImage}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}