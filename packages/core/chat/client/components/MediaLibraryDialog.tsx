// 生成素材库弹窗：列出工作区/媒体目录里的生成图片、视频与语音，支持筛选、预览与复用提示词。
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconMusic, IconPhoto, IconVideo, IconX } from "@tabler/icons-react";
import { filterMediaItems, MEDIA_FILTER_OPTIONS, type MediaFilterKind } from "../media-library";
import { libraryMediaStore } from "../library-store";
import { useLibraryMedia } from "../useLibraryState";
import { MediaThumb } from "./MediaThumb";
import styles from "./MediaLibraryDialog.module.css";

/** 生成素材库：网格浏览 + 提示词复用，数据与资料库「图像」分类共用同一读取逻辑。 */
export function MediaLibraryDialog({
  isZh,
  open,
  onClose,
  onUsePrompt,
}: {
  isZh: boolean;
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const media = useLibraryMedia();
  const [filter, setFilter] = useState<MediaFilterKind>("all");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 每次打开都重新读取，生成后立刻能看到新素材；读取与删除由共享存储统一处理。
  useEffect(() => {
    if (open) void libraryMediaStore.reload();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => filterMediaItems(media.items, filter, ""), [filter, media.items]);
  const selected = visible.find((item) => item.path === selectedPath) ?? null;
  const errorText = media.error === "load"
    ? (isZh ? "加载素材失败，请稍后再试。" : "Failed to load media.")
    : media.error === "delete"
      ? (isZh ? "删除素材失败，请稍后再试。" : "Failed to delete media.")
      : "";

  const removeSelected = async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    const removed = await libraryMediaStore.remove(selected.path);
    if (removed) {
      setSelectedPath(null);
      setConfirmDelete(false);
    }
    setDeleting(false);
  };

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={isZh ? "生成素材库" : "Generated media library"}>
        <header className={styles.header}>
          <span className={styles.title}><IconPhoto size={16} stroke={1.8} />{isZh ? "生成素材库" : "Media library"}</span>
          <div className={styles.filters} role="group" aria-label={isZh ? "素材类型" : "Media type"}>
            {MEDIA_FILTER_OPTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`${styles.filterBtn} ${filter === entry.id ? styles.filterBtnActive : ""}`}
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
              >
                {isZh ? entry.zh : entry.en}
              </button>
            ))}
          </div>
          <button type="button" className={styles.close} aria-label={isZh ? "关闭" : "Close"} onClick={onClose}>
            <IconX size={15} stroke={1.8} />
          </button>
        </header>

        {media.loading && <p className={styles.status}>{isZh ? "正在加载素材…" : "Loading media…"}</p>}
        {errorText && <p className={styles.error} role="alert">{errorText}</p>}
        {!media.loading && !errorText && visible.length === 0 && (
          <p className={styles.status}>{isZh ? "还没有生成素材。让我生成一张图片或视频试试。" : "No generated media yet."}</p>
        )}

        <div className={styles.grid}>
          {visible.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`${styles.card} ${selectedPath === item.path ? styles.cardActive : ""}`}
              onClick={() => { setSelectedPath(item.path); setConfirmDelete(false); }}
              title={item.prompt ?? item.name}
            >
              <span className={styles.thumb}>
                <MediaThumb item={item} mediaClassName={styles.thumbImage} fallbackClassName={styles.thumbFallback} />
              </span>
              <span className={styles.cardFooter}>
                <span className={styles.kindIcon} aria-hidden="true">
                  {item.kind === "video" ? <IconVideo size={12} stroke={1.8} /> : item.kind === "audio" ? <IconMusic size={12} stroke={1.8} /> : <IconPhoto size={12} stroke={1.8} />}
                </span>
                <span className={styles.cardName}>{item.name}</span>
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <footer className={styles.detail}>
            <div className={styles.detailText}>
              <span className={styles.detailName}>{selected.name}</span>
              <span className={styles.detailMeta}>
                {(selected.bytes / 1024 / 1024).toFixed(1)} MB
                {selected.model ? ` · ${selected.model}` : ""}
              </span>
              {selected.prompt && <span className={styles.detailPrompt}>{selected.prompt}</span>}
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={`${styles.deleteBtn} ${confirmDelete ? styles.deleteBtnArmed : ""}`}
                disabled={deleting}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void removeSelected();
                }}
                onBlur={() => setConfirmDelete(false)}
              >
                {deleting
                  ? (isZh ? "删除中…" : "Deleting…")
                  : confirmDelete
                    ? (isZh ? "确认删除" : "Confirm")
                    : (isZh ? "删除" : "Delete")}
              </button>
              <button
                type="button"
                className={styles.useBtn}
                disabled={!selected.prompt}
                onClick={() => {
                  if (selected.prompt) onUsePrompt(selected.prompt);
                  onClose();
                }}
              >
                {isZh ? "复用提示词" : "Reuse prompt"}
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}