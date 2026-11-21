// 聊天输入附件：图片显示可移除的缩略图，其他附件保留文件标签。
import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { ComposerAttachment } from "../composer-context";
import styles from "./ChatWorkspace.composer.module.css";

/** 组件卸载时释放本地图片 URL，并中止尚未完成的引用预览请求。 */
export function ComposerAttachmentChip({ item, onRemove }: { item: ComposerAttachment; onRemove: () => void }) {
  const [preview, setPreview] = useState<string>();
  const source = item.mediaSource?.url;
  const imageFile = item.imageFile;
  useEffect(() => {
    if (!source && !imageFile) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const show = (file: Blob) => {
      if (controller.signal.aborted || !file.type.startsWith("image/")) return;
      objectUrl = URL.createObjectURL(file);
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

  return (
    <span className={styles.attachmentChip} title={item.path ?? item.label} data-kind={preview ? "image" : item.path ? "path" : undefined}>
      {preview ? <img className={styles.attachmentPreview} src={preview} alt={item.label} /> : (
        <>
          <span className={styles.attachmentChipLabel}>{item.label}</span>
          {item.detail && <span className={styles.attachmentChipDetail}>{item.detail}</span>}
        </>
      )}
      <button type="button" className={styles.attachmentChipRemove} aria-label={item.label} onClick={onRemove}>
        <IconX size={11} aria-hidden="true" />
      </button>
    </span>
  );
}
