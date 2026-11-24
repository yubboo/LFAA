// 主题选择网格：支持明暗模式（3 列）与主题预设（4 列）分轴展示，悬停驱动实时预览，点击应用。
import { IconCheck } from "@tabler/icons-react";
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
}

/**
 * 渲染主题卡片网格。悬停/聚焦只上报预览（不改真实主题），点击/回车才应用。
 */
export function ThemeGallery({
  label,
  tiles,
  columns = 4,
  onPreview,
  onSelect,
}: {
  label: string;
  tiles: ReadonlyArray<ThemeTile>;
  /** 一轮排满的列数：明暗模式 3 列，主题预设按预设总数给列数，避免最后一张被挤到下一行。 */
  columns?: 3 | 4 | 5;
  onPreview: (tileId: string | null) => void;
  onSelect: (tileId: string) => void;
}) {
  return (
    <div
      className={styles.grid}
      data-columns={columns}
      role="group"
      aria-label={label}
    >
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          className={styles.tile}
          data-active={tile.active ? "true" : undefined}
          aria-pressed={tile.active}
          title={tile.label}
          onPointerEnter={() => onPreview(tile.id)}
          onPointerLeave={() => onPreview(null)}
          onFocus={() => onPreview(tile.id)}
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
      ))}
    </div>
  );
}
