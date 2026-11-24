// 呈现设置中心「外观」页：顶部实时预览 + 全部主题网格、主题细项与高级选项。
import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconChevronRight, IconCopy, IconDownload } from "@tabler/icons-react";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import {
  SettingGroup,
  SettingRow,
  SettingsPage,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import {
  THEME_PRESETS,
  normalizeHexColor,
  resolveAccentColor,
  type AppearanceMode,
  type ThemePresetId,
  type UiFontId,
} from "../../contract/index";
import type { AppearanceSnapshot, AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { AccentSelect } from "./AccentSelect";
import { AppearanceAdvanced } from "./AppearanceAdvanced";
import { ThemeGallery, type ThemeTile } from "./ThemeGallery";
import { ThemePreview, type ThemePreviewSample } from "./ThemePreview";
import { MODE_TILE_PREFIX, PRESET_TILE_PREFIX, buildThemeTiles } from "./theme-tiles";
import { ThemeSelect, type ThemeSelectOption } from "./ThemeSelect";
import advStyles from "./AppearanceAdvanced.module.css";
import styles from "./AppearanceSettings.module.css";

const ADVANCED_OPEN_STORAGE_KEY = "lfaa:appearance-advanced-open";

/** 装配主题、颜色、字体和高级设置，订阅外观状态以即时反映预览。 */
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
  const {
    setMode,
    applyPreset,
    updateVariant,
    updateConfig,
    exportThemeJson,
    importThemeJson,
  } = store;
  const mode = config.mode;

  const [advancedOpen, setAdvancedOpen] = useState(() =>
    readStoredJson<boolean>(
      ADVANCED_OPEN_STORAGE_KEY,
      false,
      (value): value is boolean => typeof value === "boolean",
    ),
  );
  const [notice, setNotice] = useState("");
  const [bgInput, setBgInput] = useState(activeVariant.background);
  const [fgInput, setFgInput] = useState(activeVariant.foreground);
  // 悬停预览：只驱动顶部面板，不写回真实配置；鼠标离开或失焦即回到当前主题。
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZh = locale.isZh;

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  // 同步外部切换明暗或主题预设后的色值输入框。
  if (bgInput.toUpperCase() !== activeVariant.background.toUpperCase() && /^#[0-9a-fA-F]{6}$/u.test(bgInput)) {
    setBgInput(activeVariant.background);
  }
  if (fgInput.toUpperCase() !== activeVariant.foreground.toUpperCase() && /^#[0-9a-fA-F]{6}$/u.test(fgInput)) {
    setFgInput(activeVariant.foreground);
  }

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

  /** 点击主题卡：模式卡只换明暗，预设卡应用整套配色。 */
  const selectTile = (tileId: string) => {
    setPreviewId(null);
    if (tileId.startsWith(MODE_TILE_PREFIX)) {
      setMode(tileId.slice(MODE_TILE_PREFIX.length) as AppearanceMode);
      return;
    }
    applyPreset(tileId.slice(PRESET_TILE_PREFIX.length) as ThemePresetId);
  };

  const handleCopyTheme = async () => {
    const json = exportThemeJson();
    try {
      await navigator.clipboard.writeText(json);
      setNotice(locale.themeCopied);
    } catch {
      setNotice(isZh ? "复制失败，请检查剪贴板权限。" : "Copy failed. Check clipboard permissions.");
    }
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice("");
    }, 2400);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const ok = importThemeJson(text);
    setNotice(ok ? "" : locale.themeImportInvalid);
  };

  return (
    <SettingsPage title={locale.appearance} description={locale.themeDescription}>
      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}

      {/* 实时预览：悬停主题卡时面板平滑过渡到该主题，离开即回到当前主题。 */}
      <div className={styles.stage}>
        <ThemePreview sample={previewSample} secondarySample={previewSecondary} />
        <div className={styles.stageCaption}>
          <span className={styles.stageName}>{previewLabel}</span>
          <span className={styles.stageHint}>{locale.hoverToPreview}</span>
        </div>
      </div>

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

      <SettingGroup title={locale.theme}>
        <SettingRow
          title={locale.themePreset}
          control={(
            <div className={styles.inlineControls}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenFile}
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className={styles.iconAction}
                aria-label={locale.importTheme}
                title={locale.importTheme}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconDownload aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.iconAction}
                aria-label={locale.copyTheme}
                title={locale.copyTheme}
                onClick={() => { void handleCopyTheme(); }}
              >
                <IconCopy aria-hidden="true" />
              </button>
              <ThemeSelect
                label={locale.themePreset}
                value={config.preset}
                options={Object.values(THEME_PRESETS).map((preset) => ({
                  value: preset.id,
                  label: isZh ? preset.labelZh : preset.labelEn,
                })) satisfies ThemeSelectOption<ThemePresetId>[]}
                onChange={(nextPreset) => {
                  applyPreset(nextPreset);
                  const variant = THEME_PRESETS[nextPreset][resolvedScheme];
                  setBgInput(variant.background);
                  setFgInput(variant.foreground);
                }}
              />
            </div>
          )}
        />

        <SettingRow
          title={locale.accentColor}
          control={(
            <AccentSelect
              locale={locale}
              accent={activeVariant.accent}
              customAccent={activeVariant.customAccent}
              resolvedScheme={resolvedScheme}
              onSelectAccent={(accent) => updateVariant({ accent })}
              onCustomAccentChange={(hex) => updateVariant({ accent: "custom", customAccent: hex })}
            />
          )}
        />

        <SettingRow
          title={locale.backgroundColor}
          control={(
            <label className={styles.colorField}>
              <input
                type="color"
                value={activeVariant.background}
                aria-label={locale.backgroundColor}
                onChange={(event) => {
                  const hex = event.target.value.toUpperCase();
                  setBgInput(hex);
                  updateVariant({ background: hex });
                }}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={bgInput}
                aria-label={`${locale.backgroundColor} HEX`}
                onChange={(event) => {
                  const val = event.target.value;
                  setBgInput(val);
                  if (/^#[0-9a-fA-F]{6}$/u.test(val.trim())) {
                    updateVariant({ background: normalizeHexColor(val, activeVariant.background) });
                  }
                }}
                onBlur={() => setBgInput(activeVariant.background)}
              />
            </label>
          )}
        />

        <SettingRow
          title={locale.foregroundColor}
          control={(
            <label className={styles.colorField}>
              <input
                type="color"
                value={activeVariant.foreground}
                aria-label={locale.foregroundColor}
                onChange={(event) => {
                  const hex = event.target.value.toUpperCase();
                  setFgInput(hex);
                  updateVariant({ foreground: hex });
                }}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={fgInput}
                aria-label={`${locale.foregroundColor} HEX`}
                onChange={(event) => {
                  const val = event.target.value;
                  setFgInput(val);
                  if (/^#[0-9a-fA-F]{6}$/u.test(val.trim())) {
                    updateVariant({ foreground: normalizeHexColor(val, activeVariant.foreground) });
                  }
                }}
                onBlur={() => setFgInput(activeVariant.foreground)}
              />
            </label>
          )}
        />

        <SettingRow
          title={locale.uiFont}
          control={(
            <ThemeSelect
              label={locale.uiFont}
              value={activeVariant.font}
              options={[
                { value: "system", label: locale.motionSystem },
                { value: "sans", label: "Sans-serif" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Monospace" },
              ] satisfies ThemeSelectOption<UiFontId>[]}
              onChange={(font) => updateVariant({ font })}
            />
          )}
        />
      </SettingGroup>

      <button
        type="button"
        className={advStyles.advancedToggle}
        aria-expanded={advancedOpen}
        onClick={() => {
          setAdvancedOpen((open) => {
            const next = !open;
            writeStoredJson(ADVANCED_OPEN_STORAGE_KEY, next);
            return next;
          });
        }}
      >
        <span>{locale.advancedSettings}</span>
        {advancedOpen ? <IconChevronDown aria-hidden="true" /> : <IconChevronRight aria-hidden="true" />}
      </button>

      {advancedOpen && (
        <AppearanceAdvanced
          locale={locale}
          config={config}
          onUpdateConfig={updateConfig}
        />
      )}
    </SettingsPage>
  );
}