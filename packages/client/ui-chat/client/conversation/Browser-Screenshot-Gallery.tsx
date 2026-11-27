// 浏览器验收截图画廊：以「已查看 N 张图像」简洁折叠行呈现横向圆角缩略图网格，点击缩略图可展开清晰大图。
import { memo, useState } from "react";
import { IconChevronRight, IconPhoto } from "@tabler/icons-react";
import { BrowserEvidence } from "./Browser-Evidence";
import styles from "./Browser-Screenshot-Gallery.module.css";

export interface BrowserGalleryItem {
  id: string;
  sessionId: string;
  caption?: string | undefined;
}

/** 轻量可折叠截图画廊：默认展开并排展示圆角缩略图，点击单张可原地切换高清大图。 */
export const BrowserScreenshotGallery = memo(function BrowserScreenshotGallery({
  items,
  isZh,
}: {
  items: readonly BrowserGalleryItem[];
  isZh: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState<string>();

  if (items.length === 0) return null;

  const title = isZh
    ? `已查看 ${items.length} 张图像`
    : `Viewed ${items.length} ${items.length === 1 ? "image" : "images"}`;
  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-label={open ? (isZh ? `收起${title}` : `Collapse ${title}`) : (isZh ? `展开${title}` : `Expand ${title}`)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconPhoto size={15} stroke={1.7} className={styles.icon} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        <IconChevronRight
          size={13}
          stroke={1.9}
          className={styles.chevron}
          data-open={open ? "true" : undefined}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.strip}>
            {items.map((item) => {
              const selected = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.thumbCard}
                  data-selected={selected ? "true" : undefined}
                  aria-pressed={selected}
                  aria-label={selected
                    ? (isZh ? "收起截图预览" : "Collapse screenshot")
                    : (isZh ? "展开实时验收截图" : "Expand verification screenshot")}
                  title={item.caption}
                  onClick={() => setActiveId((cur) => (cur === item.id ? undefined : item.id))}
                >
                  <BrowserEvidence id={item.id} sessionId={item.sessionId} isZh={isZh} compact />
                </button>
              );
            })}
          </div>

          {activeItem && (
            <div className={styles.previewWrap}>
              {activeItem.caption && <div className={styles.previewCaption}>{activeItem.caption}</div>}
              <button
                type="button"
                className={styles.previewBtn}
                aria-label={isZh ? "收起截图预览" : "Collapse screenshot"}
                onClick={() => setActiveId(undefined)}
              >
                <BrowserEvidence id={activeItem.id} sessionId={activeItem.sessionId} isZh={isZh} compact={false} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
