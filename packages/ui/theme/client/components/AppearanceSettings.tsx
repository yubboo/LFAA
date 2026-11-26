// 呈现设置中心「外观」页：顶部是分区选项卡，没有常驻预览舞台。
// 「主题」是一面完整外观卡墙：5 套纯色主题 + 内置背景主题 + 个人背景主题，一张卡同时带配色与背景；
// 鼠标移入卡片时在光标旁浮出实时预览，并用「预览」光标替代系统指针，避免上下滚动。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import { SettingGroup, SettingsPage, settingsStyles } from "@lfaa/ui-primitives/client";
import type { AppearanceMode } from "../../contract/index";
import { resolveBackgroundUrl, type AppearanceSnapshot, type AppearanceStore } from "../appearance-store";
import { BUILTIN_BACKGROUNDS } from "../assets/backgrounds/index";
import type { ThemeLocaleMessages } from "../locales";
import { AppearanceAdvanced } from "./AppearanceAdvanced";
import { AppearanceTabs, type AppearanceTabId } from "./AppearanceTabs";
import { AppearanceThemeDetail } from "./AppearanceThemeDetail";
import { ThemeGallery, type PreviewOrigin, type ThemeTile } from "./ThemeGallery";
import { ThemeHoverPreview, type ThemeHoverPreviewState } from "./ThemeHoverPreview";
import { MODE_TILE_PREFIX, buildThemeTiles } from "./theme-tiles";
import { CUSTOM_LOOK_PREFIX, buildThemeLooks } from "./theme-looks";
import { useThemeBackgrounds } from "./use-theme-backgrounds";
import styles from "./AppearanceSettings.module.css";

const TAB_STORAGE_KEY = "lfaa:appearance-tab";

/** 装配分区选项卡、主题卡墙与悬停预览，订阅外观状态以即时反映选择。 */
export function AppearanceSettings({
  locale,
  store,
  snapshot,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  snapshot: AppearanceSnapshot;
}) {
  const { config, resolvedScheme } = snapshot;
  const { setMode, applyThemeLook, updateConfig } = store;
  const mode = config.mode;
  const isZh = locale.isZh;

  const [tab, setTab] = useState<AppearanceTabId>(() =>
    readStoredJson<AppearanceTabId>(
      TAB_STORAGE_KEY,
      "presets",
      (value): value is AppearanceTabId => value === "presets" || value === "advanced",
    ),
  );
  // 悬停预览：鼠标移入卡片时浮在光标旁，离开/滚动/点击即收起；不写回真实配置。
  const [hoverPreview, setHoverPreview] = useState<ThemeHoverPreviewState | null>(null);
  // 卡片之间移动时 leave→enter 会连发；延迟收起 70ms，避免浮层闪一下又重新挂载。
  const hideTimer = useRef<number | null>(null);
  const clearHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);
  useEffect(() => clearHide, [clearHide]);
  const backgrounds = useThemeBackgrounds(store, locale);

  // 当前背景以工作区为准；应用任意主题卡时会把工作区与设置中心一起同步。
  const background = config.backgrounds.workspace;
  const backgroundUrl = resolveBackgroundUrl(background);

  // 主题卡墙：每张卡只用自己的固定取样（配色 + 该卡自带的背景），不跟随当前选择。
  const looks = useMemo(
    () =>
      buildThemeLooks({
        builtins: BUILTIN_BACKGROUNDS,
        customs: backgrounds.customs,
        scheme: resolvedScheme,
        isZh,
        preset: config.preset,
        background,
        confirmId: backgrounds.confirmId,
      }),
    [background, backgrounds.confirmId, backgrounds.customs, config.preset, isZh, resolvedScheme],
  );

  // 明暗模式卡只比较明暗；悬停时浮层仍保留当前背景。
  const modeTiles = useMemo<ThemeTile[]>(
    () => buildThemeTiles({ mode, preset: config.preset, scheme: resolvedScheme, isZh })
      .filter((tile) => tile.id.startsWith(MODE_TILE_PREFIX)),
    [config.preset, isZh, mode, resolvedScheme],
  );

  /** 悬停/聚焦取样：主题卡用自己的固定外观，明暗卡用当前配色 + 当前背景。 */
  const previewTile = useCallback((tileId: string | null, origin?: PreviewOrigin) => {
    clearHide();
    if (!tileId || !origin) {
      hideTimer.current = window.setTimeout(() => {
        hideTimer.current = null;
        setHoverPreview(null);
      }, 70);
      return;
    }
    const look = looks.find((item) => item.id === tileId);
    if (look) {
      setHoverPreview({
        id: tileId,
        label: look.label,
        sample: look.sample,
        follow: origin.follow,
        x: origin.x,
        y: origin.y,
      });
      return;
    }
    const modeTile = modeTiles.find((item) => item.id === tileId);
    if (!modeTile) {
      setHoverPreview(null);
      return;
    }
    setHoverPreview({
      id: tileId,
      label: modeTile.label,
      sample: { ...modeTile.sample, image: backgroundUrl },
      ...(modeTile.secondarySample
        ? { secondarySample: { ...modeTile.secondarySample, image: backgroundUrl } }
        : {}),
      follow: origin.follow,
      x: origin.x,
      y: origin.y,
    });
  }, [backgroundUrl, clearHide, looks, modeTiles]);
  const dismissPreview = useCallback(() => {
    clearHide();
    setHoverPreview(null);
  }, [clearHide]);

  /** 切换分区：切走时收起悬停预览，避免浮层留在另一个分区上。 */
  const changeTab = (next: AppearanceTabId) => {
    setTab(next);
    dismissPreview();
    writeStoredJson(TAB_STORAGE_KEY, next);
  };

  /** 点击卡片：明暗卡只换模式；主题卡一次应用配色与背景。 */
  const selectTile = useCallback((tileId: string) => {
    dismissPreview();
    if (tileId.startsWith(MODE_TILE_PREFIX)) {
      setMode(tileId.slice(MODE_TILE_PREFIX.length) as AppearanceMode);
      return;
    }
    const look = looks.find((item) => item.id === tileId);
    if (look) applyThemeLook(look.preset, look.background);
  }, [applyThemeLook, dismissPreview, looks, setMode]);

  /** 个人图主题的删除只处理卡墙里的 custom 前缀。 */
  const deleteLook = useCallback((tileId: string) => {
    if (tileId.startsWith(CUSTOM_LOOK_PREFIX)) {
      backgrounds.requestDelete(tileId.slice(CUSTOM_LOOK_PREFIX.length));
    }
  }, [backgrounds.requestDelete]);

  const cursorHidden = hoverPreview?.follow === true;

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
            onPreview={previewTile}
            onSelect={selectTile}
            cursorHidden={cursorHidden}
          />
        </SettingGroup>

        {/* 主题 = 完整外观：一张卡同时带配色与背景，点一次整套应用；上传自己的图也是往这面墙里加一张。 */}
        <SettingGroup
          title={locale.themeGroup}
          actions={(
            <button
              type="button"
              className={settingsStyles.actionBtn}
              disabled={backgrounds.busy}
              aria-label={locale.backgroundUpload}
              title={locale.backgroundUploadHint}
              onClick={() => backgrounds.fileInputRef.current?.click()}
            >
              <IconPlus size={13} stroke={2} aria-hidden="true" />
              {backgrounds.busy ? locale.backgroundUploading : locale.backgroundUploadShort}
            </button>
          )}
        >
          <ThemeGallery
            label={locale.themeGroup}
            tiles={looks}
            columns={5}
            onPreview={previewTile}
            onSelect={selectTile}
            deleteLabel={locale.backgroundDelete}
            confirmLabel={locale.backgroundConfirmDelete}
            cursorHidden={cursorHidden}
            onDelete={deleteLook}
          />

          <input
            ref={backgrounds.fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              void backgrounds.handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {backgrounds.notice && (
            <p className={settingsStyles.notice} role="status">{backgrounds.notice}</p>
          )}
        </SettingGroup>
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

      {/* 悬停预览浮层：Portal 到 body，跟手但不拦截鼠标；键盘聚焦时固定锚点。 */}
      <ThemeHoverPreview
        hover={hoverPreview}
        cursorLabel={locale.previewCursor}
        clickHint={locale.clickToApply}
        onDismiss={dismissPreview}
      />
    </SettingsPage>
  );
}