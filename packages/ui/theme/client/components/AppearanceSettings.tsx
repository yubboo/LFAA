// 呈现设置中心「外观」页：顶部实时预览与「预设 / 高级设置」两个分区；
// 预设分区放明暗模式与主题风格网格，高级设置分区收纳配色细项、字号、字体、主题与显示、动效与光标。
import { useMemo, useState } from "react";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import { SettingGroup, SettingsPage } from "@lfaa/ui-primitives/client";
import {
  THEME_PRESETS,
  resolveAccentColor,
  type AppearanceMode,
  type ThemePresetId,
} from "../../contract/index";
import type { AppearanceSnapshot, AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { AppearanceAdvanced } from "./AppearanceAdvanced";
import { AppearanceTabs, type AppearanceTabId } from "./AppearanceTabs";
import { AppearanceThemeDetail } from "./AppearanceThemeDetail";
import { BackgroundSettings } from "./BackgroundSettings";
import { ThemeGallery, type ThemeTile } from "./ThemeGallery";
import { ThemePreview, type ThemePreviewSample } from "./ThemePreview";
import { MODE_TILE_PREFIX, PRESET_TILE_PREFIX, buildThemeTiles } from "./theme-tiles";
import styles from "./AppearanceSettings.module.css";

const TAB_STORAGE_KEY = "lfaa:appearance-tab";

/** 装配实时预览、分区选项卡与各自的设置分组，订阅外观状态以即时反映预览。 */
export function AppearanceSettings({
  locale,
  store,
  snapshot,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  snapshot: AppearanceSnapshot;
}) {
  const { config, resolvedScheme, activeVariant } = snapshot;
  const { setMode, applyPreset, updateConfig } = store;
  const mode = config.mode;

  const [tab, setTab] = useState<AppearanceTabId>(() =>
    readStoredJson<AppearanceTabId>(
      TAB_STORAGE_KEY,
      "presets",
      (value): value is AppearanceTabId => value === "presets" || value === "advanced",
    ),
  );
  // 悬停预览：只驱动顶部面板，不写回真实配置；鼠标离开或失焦即回到当前主题。
  const [previewId, setPreviewId] = useState<string | null>(null);
  const isZh = locale.isZh;

  const modeOptions: Array<{ mode: AppearanceMode; label: string }> = [
    { mode: "system", label: locale.system },
    { mode: "light", label: locale.light },
    { mode: "dark", label: locale.dark },
  ];

  // 主题取样：预设取自已登记的 THEME_PRESETS，强调色按明暗方案统一解析。
  const currentSample: ThemePreviewSample = {
    background: activeVariant.background,
    foreground: activeVariant.foreground,
    accent: resolveAccentColor(activeVariant, resolvedScheme),
    glass: THEME_PRESETS[config.preset].glassEnabled,
    scheme: resolvedScheme,
  };

  // 网格拆分：明暗模式（3 列）与主题配色预设（4 列）各自成组，避免 7 张卡混排且双黑框打架。
  const tiles = useMemo<ThemeTile[]>(
    () => buildThemeTiles({ mode, preset: config.preset, scheme: resolvedScheme, isZh }),
    [config.preset, isZh, mode, resolvedScheme],
  );
  const modeTiles = useMemo(
    () => tiles.filter((tile) => tile.id.startsWith(MODE_TILE_PREFIX)),
    [tiles],
  );
  const presetTiles = useMemo(
    () => tiles.filter((tile) => tile.id.startsWith(PRESET_TILE_PREFIX)),
    [tiles],
  );
  // 配色卡列数跟随预设总数：一轮排满不出现落单；超出 5 张时回到 4 列折行。
  const presetColumns: 3 | 4 | 5 = presetTiles.length === 5 ? 5 : 4;

  const previewSample = tiles.find((tile) => tile.id === previewId)?.sample ?? currentSample;
  const previewSecondary = tiles.find((tile) => tile.id === previewId)?.secondarySample;
  // 面板标题跟随悬停项；未悬停时显示当前主题（模式 + 预设）名称。
  const activeModeLabel = modeOptions.find((option) => option.mode === mode)?.label ?? locale.themeMode;
  const activePreset = THEME_PRESETS[config.preset];
  const previewLabel = previewId
    ? (tiles.find((tile) => tile.id === previewId)?.label ?? activeModeLabel)
    : `${activeModeLabel} · ${isZh ? activePreset.labelZh : activePreset.labelEn}`;

  /** 切换分区：切走时清掉悬停预览，避免上一个分区的主题卡继续驱动面板。 */
  const changeTab = (next: AppearanceTabId) => {
    setTab(next);
    setPreviewId(null);
    writeStoredJson(TAB_STORAGE_KEY, next);
  };

  /** 点击主题卡：模式卡只换明暗，预设卡应用整套配色。 */
  const selectTile = (tileId: string) => {
    setPreviewId(null);
    if (tileId.startsWith(MODE_TILE_PREFIX)) {
      setMode(tileId.slice(MODE_TILE_PREFIX.length) as AppearanceMode);
      return;
    }
    applyPreset(tileId.slice(PRESET_TILE_PREFIX.length) as ThemePresetId);
  };

  return (
    <SettingsPage title={locale.appearance} description={locale.themeDescription}>
      {/* 分区选项卡：预设与高级设置各占一个面板，选中项记在本地，重新打开仍是同一分区。 */}
      <AppearanceTabs
        value={tab}
        label={locale.appearance}
        items={[
          { id: "presets", label: locale.presetsTab },
          { id: "advanced", label: locale.advancedTab },
        ]}
        onChange={changeTab}
      />

      {/* 实时预览：悬停主题卡时面板平滑过渡到该主题，离开即回到当前主题；两个分区都常驻。 */}
      <div className={styles.stage}>
        <ThemePreview sample={previewSample} secondarySample={previewSecondary} />
        <div className={styles.stageCaption}>
          <span className={styles.stageName}>{previewLabel}</span>
          {tab === "presets" && <span className={styles.stageHint}>{locale.hoverToPreview}</span>}
        </div>
      </div>

      {/* 两个面板都保持挂载，只用 hidden 切换：导入/复制的提示与输入态不会因切页丢失，aria-controls 也始终有目标。 */}
      <div
        className={styles.panel}
        role="tabpanel"
        id="appearance-panel-presets"
        aria-labelledby="appearance-tab-presets"
        hidden={tab !== "presets"}
      >
        <SettingGroup
          title={isZh ? "明暗模式" : "Color Mode"}
          description={isZh ? "选择浅色、深色或自动跟随系统外观。" : "Choose light, dark, or match your system appearance."}
        >
          <ThemeGallery
            label={isZh ? "明暗模式" : "Color Mode"}
            tiles={modeTiles}
            columns={3}
            onPreview={setPreviewId}
            onSelect={selectTile}
          />
        </SettingGroup>

        <SettingGroup
          title={isZh ? "主题风格" : "Theme Presets"}
          description={locale.allThemesDesc}
        >
          <ThemeGallery
            label={isZh ? "主题风格" : "Theme Presets"}
            tiles={presetTiles}
            columns={presetColumns}
            onPreview={setPreviewId}
            onSelect={selectTile}
          />
        </SettingGroup>

        <BackgroundSettings locale={locale} store={store} snapshot={snapshot} />
      </div>

      <div
        className={styles.panel}
        role="tabpanel"
        id="appearance-panel-advanced"
        aria-labelledby="appearance-tab-advanced"
        hidden={tab !== "advanced"}
      >
        <AppearanceThemeDetail locale={locale} store={store} snapshot={snapshot} />
        <AppearanceAdvanced
          locale={locale}
          config={config}
          onUpdateConfig={updateConfig}
        />
      </div>
    </SettingsPage>
  );
}