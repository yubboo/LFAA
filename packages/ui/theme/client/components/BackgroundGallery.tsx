// 背景图片卡片网格：纯色卡 + 图片卡，支持选中标记与个人图片删除；供外观页预设分区使用。
import { IconCheck, IconTrash } from "@tabler/icons-react";
import styles from "./BackgroundGallery.module.css";

/** 网格里的一张背景卡。 */
export interface BackgroundTileItem {
  id: string;
  label: string;
  /** 图片卡使用；纯色卡不传。 */
  imageUrl?: string;
  /** 纯色卡显示当前主题的背景/前景色小样。 */
  solid?: { background: string; foreground: string };
  active: boolean;
  /** 个人图片才显示删除按钮。 */
  deletable?: boolean;
  /** 删除按钮处于二次确认态。 */
  confirmDelete?: boolean;
}

/** 渲染背景卡网格；选中应用由调用方处理，删除只对个人图片开放。 */
export function BackgroundGallery({
  label,
  items,
  deleteLabel,
  confirmLabel,
  onSelect,
  onDelete,
}: {
  label: string;
  items: ReadonlyArray<BackgroundTileItem>;
  deleteLabel: string;
  confirmLabel: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {items.map((item) => (
        <div key={item.id} className={styles.tile} data-active={item.active ? "true" : undefined}>
          <button
            type="button"
            className={styles.pick}
            aria-pressed={item.active}
            title={item.label}
            onClick={() => onSelect(item.id)}
          >
            <span
              className={styles.thumb}
              style={item.solid ? { background: item.solid.background } : undefined}
            >
              {item.solid ? (
                <span
                  className={styles.solidSample}
                  style={{ background: item.solid.foreground }}
                  aria-hidden="true"
                />
              ) : (
                <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
              )}
              <span className={styles.namePill}>{item.label}</span>
              {item.active && (
                <span className={styles.badge} aria-hidden="true">
                  <IconCheck size={11} stroke={2.8} />
                </span>
              )}
            </span>
          </button>
          {item.deletable && onDelete && (
            <button
              type="button"
              className={styles.remove}
              data-confirm={item.confirmDelete ? "true" : undefined}
              aria-label={item.confirmDelete ? confirmLabel : deleteLabel}
              title={item.confirmDelete ? confirmLabel : deleteLabel}
              onClick={() => onDelete(item.id)}
            >
              {item.confirmDelete ? confirmLabel : <IconTrash size={13} />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}