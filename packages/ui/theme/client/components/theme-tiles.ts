// 主题网格取样：把「明暗模式 + 主题预设」拼成主题卡列表，供外观页与复用方共用（纯函数，便于单测）。
import {
  ACCENT_PRESETS,
  THEME_PRESETS,
  type AppearanceMode,
  type ThemePresetId,
} from "../../contract/index";
import type { ThemeTile } from "./ThemeGallery";

/** 主题卡 id 前缀：`mode:` 只改明暗，`preset:` 应用整套配色。 */
export const MODE_TILE_PREFIX = "mode:";
export const PRESET_TILE_PREFIX = "preset:";

/** 取某预设在某明暗下的取样（背景、前景、解析后的强调色）。 */
export function sampleOfPreset(presetId: ThemePresetId, scheme: "light" | "dark") {
  const definition = THEME_PRESETS[presetId];
  const variant = definition[scheme];
  const accent = ACCENT_PRESETS.find((item) => item.id === variant.accent)?.color ?? variant.accent;
  return {
    background: variant.background,
    foreground: variant.foreground,
    accent,
    glass: definition.glassEnabled,
    scheme,
  };
}

/**
 * 构建主题网格：3 张明暗模式卡（「跟随系统」左右各半）+ 每个预设一张配色卡。
 * 当前模式与当前预设在各自轴上分别标记为选中；缩略卡只画配色，背景由顶部舞台负责合成。
 */
export function buildThemeTiles({
  mode,
  preset,
  scheme,
  isZh,
}: {
  mode: AppearanceMode;
  preset: ThemePresetId;
  scheme: "light" | "dark";
  isZh: boolean;
}): ThemeTile[] {
  const modeLabels: Array<{ mode: AppearanceMode; label: string }> = [
    { mode: "system", label: isZh ? "跟随系统" : "System" },
    { mode: "light", label: isZh ? "浅色" : "Light" },
    { mode: "dark", label: isZh ? "深色" : "Dark" },
  ];

  const modeTiles: ThemeTile[] = modeLabels.map((entry) => {
    const active = mode === entry.mode;
    if (entry.mode === "system") {
      return {
        id: `${MODE_TILE_PREFIX}system`,
        label: entry.label,
        sample: sampleOfPreset(preset, "light"),
        secondarySample: sampleOfPreset(preset, "dark"),
        active,
      };
    }
    return {
      id: `${MODE_TILE_PREFIX}${entry.mode}`,
      label: entry.label,
      sample: sampleOfPreset(preset, entry.mode),
      active,
    };
  });

  const presetTiles: ThemeTile[] = Object.values(THEME_PRESETS).map((definition) => ({
    id: `${PRESET_TILE_PREFIX}${definition.id}`,
    label: isZh ? definition.labelZh : definition.labelEn,
    sample: sampleOfPreset(definition.id, scheme),
    active: preset === definition.id,
  }));

  return [...modeTiles, ...presetTiles];
}