// 主题选择网格：支持明暗模式（3 列）与主题方案（5 列）分轴展示，悬停驱动实时预览，点击应用；
// 个人背景主题带一个可二次确认的删除按钮。
import { memo } from "react";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { ThemePreview, type ThemePreviewSample } from "./ThemePreview";
import styles from "./ThemeGallery.module.css";

/** 网格里的一张主题卡。 */
export interface ThemeTile {
  id: string;
  label: string;
  sample: ThemePreviewSample;
  /** 「跟随系统」这类需要左右对照的卡：给出第二份取样即渲染成左右各半。 */
  secondarySample?: ThemePreviewSample | undefined;
  /** 是否是当前已应用的主题。 */
  active: boolean;
  /** 个人背景主题才显示删除按钮。 */
  deletable?: boolean;
  /** 删除按钮处于二次确认态。 */
  confirmDelete?: boolean;
}

/** 悬停/聚焦的锚点：鼠标给指针坐标并跟随，键盘给卡片坐标但不跟随。 */
export interface PreviewOrigin {
  x: number;
  y: number;
  follow: boolean;
}

/**
 * 渲染主题卡片网格。悬停/聚焦只上报预览（不改真实主题），点击/回车才应用。
 */
export const ThemeGallery = memo(function ThemeGallery({
  label,
  tiles,
  columns = 4,
  onPreview,
  onSelect,
  onDelete,
  deleteLabel,
  confirmLabel,
  cursorHidden = false,
}: {
  label: string;
  tiles: ReadonlyArray<ThemeTile>;
  /** 一轮排满的列数：明暗模式 3 列，主题方案 5 列。 */
  columns?: 3 | 4 | 5;
  onPreview: (tileId: string | null, origin?: PreviewOrigin) => void;
  onSelect: (tileId: string) => void;
  /** 个人背景主题的删除动作；不传则不渲染删除按钮。 */
  onDelete?: (tileId: string) => void;
  deleteLabel?: string;
  confirmLabel?: string;
  /** 悬停预览出现时隐藏系统指针，由浮层的「预览」光标接管。 */
  cursorHidden?: boolean;
}) {
  return (
    <div
      className={styles.grid}
      data-columns={columns}
      data-cursor={cursorHidden ? "none" : undefined}
      role="group"
      aria-label={label}
    >
      {tiles.map((tile) => (
        <div key={tile.id} className={styles.cell}>
          <button
            type="button"
            className={styles.tile}
            data-active={tile.active ? "true" : undefined}
            aria-pressed={tile.active}
            aria-label={tile.label}
            onPointerEnter={(event) => onPreview(tile.id, { x: event.clientX, y: event.clientY, follow: true })}
            onPointerLeave={() => onPreview(null)}
            onFocus={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onPreview(tile.id, { x: rect.right - 8, y: rect.top + 8, follow: false });
            }}
            onBlur={() => onPreview(null)}
            onClick={() => onSelect(tile.id)}
          >
            <span className={styles.thumb}>
              <ThemePreview
                variant="tile"
                sample={tile.sample}
                secondarySample={tile.secondarySample}
              />
              {tile.active && (
                <span className={styles.activeBadge} aria-hidden="true">
                  <IconCheck size={11} stroke={2.8} />
                </span>
              )}
            </span>
            <span className={styles.label}>{tile.label}</span>
          </button>

          {tile.deletable && onDelete && deleteLabel && confirmLabel && (
            <button
              type="button"
              className={styles.remove}
              data-confirm={tile.confirmDelete ? "true" : undefined}
              aria-label={tile.confirmDelete ? confirmLabel : deleteLabel}
              title={tile.confirmDelete ? confirmLabel : deleteLabel}
              onClick={() => onDelete(tile.id)}
            >
              <IconTrash size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
});