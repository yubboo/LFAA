// 主题方案取样：一套主题 = 一套配色 + 一张背景（或纯色）。
// 把 5 套纯色预设、内置背景与个人背景拍平成同一面卡墙（纯函数，便于单测）。
import { DEFAULT_APPEARANCE_CONFIG, THEME_PRESETS, type BackgroundChoice, type ThemePresetId } from "../../contract/index";
import type { BuiltinBackground } from "../assets/backgrounds/index";
import { customBackgroundUrl } from "../background-api";
import { sampleOfPreset } from "./theme-tiles";
import type { ThemeTile } from "./ThemeGallery";

/** 一面主题卡：缩略图、配色与点击后要同时应用的背景选择。 */
export interface ThemeLookTile extends ThemeTile {
  preset: ThemePresetId;
  background: BackgroundChoice;
}

/** 纯色主题的固定 id 前缀与背景图主题的 id 前缀（个人图单独一段）。 */
export const PRESET_LOOK_PREFIX = "look:preset:";
export const IMAGE_LOOK_PREFIX = "look:bg:";
export const CUSTOM_LOOK_PREFIX = "look:custom:";

/** 两个背景选择是否指向同一张图/同一个纯色。 */
export function sameBackgroundChoice(left: BackgroundChoice, right: BackgroundChoice): boolean {
  if (left.kind === "default" || right.kind === "default") return left.kind === right.kind;
  return left.kind === right.kind && left.id === right.id;
}

/** 内置图声明的配色；缺失或非法时回退液态玻璃，避免坏清单把卡墙打断。 */
function paletteOf(item: BuiltinBackground): ThemePresetId {
  return item.preset && item.preset in THEME_PRESETS
    ? (item.preset as ThemePresetId)
    : "liquidGlass";
}

/**
 * 构建主题卡墙：先排 5 套纯色主题，再排内置背景主题，个人图排最后。
 * 卡面只用自己的固定取样（图片 + 配套配色），不跟随当前选择，便于一眼比较。
 */
export function buildThemeLooks({
  builtins,
  customs,
  scheme,
  isZh,
  preset,
  background,
  confirmId,
}: {
  builtins: ReadonlyArray<BuiltinBackground>;
  customs: ReadonlyArray<{ id: string; name: string }>;
  scheme: "light" | "dark";
  isZh: boolean;
  preset: ThemePresetId;
  background: BackgroundChoice;
  confirmId?: string | null;
}): ThemeLookTile[] {
  const solidLooks: ThemeLookTile[] = Object.values(THEME_PRESETS).map((definition) => ({
    id: `${PRESET_LOOK_PREFIX}${definition.id}`,
    label: isZh ? definition.labelZh : definition.labelEn,
    preset: definition.id,
    background: { kind: "default" },
    sample: sampleOfPreset(definition.id, scheme),
    active: preset === definition.id && sameBackgroundChoice(background, { kind: "default" }),
  }));

  const imageLooks: ThemeLookTile[] = builtins.map((item) => {
    const palette = paletteOf(item);
    return {
      id: `${IMAGE_LOOK_PREFIX}${item.id}`,
      label: isZh ? item.labelZh : item.labelEn,
      preset: palette,
      background: { kind: "builtin", id: item.id },
      sample: { ...sampleOfPreset(palette, scheme), image: item.src },
      active: preset === palette && sameBackgroundChoice(background, { kind: "builtin", id: item.id }),
    };
  });

  const customLooks: ThemeLookTile[] = customs.map((item) => ({
    id: `${CUSTOM_LOOK_PREFIX}${item.id}`,
    label: item.name.replace(/\.[^.]+$/u, ""),
    preset: DEFAULT_APPEARANCE_CONFIG.preset,
    background: { kind: "custom", id: item.id },
    sample: { ...sampleOfPreset(DEFAULT_APPEARANCE_CONFIG.preset, scheme), image: customBackgroundUrl(item.id) },
    active: preset === DEFAULT_APPEARANCE_CONFIG.preset
      && sameBackgroundChoice(background, { kind: "custom", id: item.id }),
    deletable: true,
    confirmDelete: confirmId === item.id,
  }));

  return [...solidLooks, ...imageLooks, ...customLooks];
}