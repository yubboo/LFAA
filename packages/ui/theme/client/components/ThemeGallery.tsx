// 主题选择网格：每个主题一格缩略窗，鼠标移入即回报预览请求，点击才应用；供外观页与任何需要选主题的界面复用。
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
 * 渲染主题网格。悬停/聚焦只上报预览（不改真实主题），点击/回车才应用，
 * 因此调用方可以用同一个 `onPreview` 驱动任意大小的实时预览面板。
 */
export function ThemeGallery({
  label,
  tiles,
  onPreview,
  onSelect,
}: {
  label: string;
  tiles: ReadonlyArray<ThemeTile>;
  onPreview: (tileId: string | null) => void;
  onSelect: (tileId: string) => void;
}) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
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
          </span>
          <span className={styles.label}>{tile.label}</span>
        </button>
      ))}
    </div>
  );
}