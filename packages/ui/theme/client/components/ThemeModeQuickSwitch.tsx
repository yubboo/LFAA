// 用户菜单头部的三档外观开关：左=深色、中=跟随系统、右=浅色。
// 外观按参考图还原：玻璃轨道 + 带光晕的方块滑块 + 像素月亮/太阳；点轨道哪一段就切到哪一档。
import { useRef, type KeyboardEvent } from "react";
import type { AppearanceMode } from "../../contract/index";
import type { AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { pixelCells, type PixelGlyphKind } from "./pixel-glyph";
import styles from "./ThemeModeQuickSwitch.module.css";

/** 轨道从左到右的三档，顺序即滑块位置。 */
const STOPS: Array<{ mode: AppearanceMode; key: "darkModeLabel" | "system" | "lightModeLabel" }> = [
  { mode: "dark", key: "darkModeLabel" },
  { mode: "system", key: "system" },
  { mode: "light", key: "lightModeLabel" },
];

/** 像素点阵图标：9×9 网格上的圆角方块，按当前档位换月亮 / 太阳。 */
function PixelGlyph({ kind, className }: { kind: PixelGlyphKind; className?: string | undefined }) {
  return (
    <svg className={className} viewBox="0 0 9 9" aria-hidden="true" focusable="false">
      {pixelCells(kind).map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x + 0.07} y={y + 0.07} width={0.86} height={0.86} rx={0.2} />
      ))}
    </svg>
  );
}

/** 三档拨动开关：轨道点击选档，方向键 / Home / End 在档位间移动。 */
export function ThemeModeQuickSwitch({
  locale,
  store,
  mode,
  resolvedScheme,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  mode: AppearanceMode;
  /** 「跟随系统」档显示哪个图标，取决于系统实际解析出的明暗。 */
  resolvedScheme: "light" | "dark";
}) {
  const stops = STOPS.map((stop) => ({ mode: stop.mode, label: locale[stop.key] }));
  const activeIndex = Math.max(0, stops.findIndex((stop) => stop.mode === mode));
  const stopRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const glyph: PixelGlyphKind = resolvedScheme === "light" ? "sun" : "moon";

  const select = (index: number) => {
    const stop = stops[index];
    if (!stop) return;
    store.setMode(stop.mode);
    stopRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (step !== 0) {
      event.preventDefault();
      select((activeIndex + step + stops.length) % stops.length);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : stops.length - 1);
    }
  };

  return (
    <div
      className={styles.switch}
      role="radiogroup"
      aria-label={locale.quickThemeSwitch}
      data-stop={activeIndex}
      data-scheme={resolvedScheme}
      data-glyph={glyph}
      onKeyDown={onKeyDown}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb}>
          <PixelGlyph kind={glyph} className={styles.glyph} />
        </span>
      </span>
      {stops.map((stop, index) => (
        <button
          key={stop.mode}
          ref={(element) => { stopRefs.current[index] = element; }}
          className={styles.stop}
          type="button"
          role="radio"
          aria-checked={mode === stop.mode}
          aria-label={stop.label}
          title={stop.label}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => store.setMode(stop.mode)}
        />
      ))}
    </div>
  );
}