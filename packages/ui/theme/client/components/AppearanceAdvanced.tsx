// 呈现外观设置「高级设置」分区里的字号、字体、主题与显示、动效与光标分组，全部沿用设置中心的行式结构
// （左名称右控件、分组不加框）；分区切换与面板间距由页面统一维护。
import type {
  AppearanceConfig,
  CodeFontId,
  ContentFontId,
  DiffMarkerMode,
  FontWeightId,
  ReducedMotionMode,
} from "../../contract/index";
import {
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingSwitch,
} from "@lfaa/ui-primitives/client";
import type { ThemeLocaleMessages } from "../locales";
import { ThemeSelect, type ThemeSelectOption } from "./ThemeSelect";
import advStyles from "./AppearanceAdvanced.module.css";

/** 渲染可折叠的高级外观控制，更新当前主题变体中的显示参数。 */
export function AppearanceAdvanced({
  locale,
  config,
  onUpdateConfig,
}: {
  locale: ThemeLocaleMessages;
  config: AppearanceConfig;
  onUpdateConfig: (patch: Partial<AppearanceConfig>) => void;
}) {
  const motionOptions: Array<{ value: ReducedMotionMode; label: string }> = [
    { value: "system", label: locale.motionSystem },
    { value: "on", label: locale.motionOn },
    { value: "off", label: locale.motionOff },
  ];

  const diffOptions: Array<{ value: DiffMarkerMode; label: string }> = [
    { value: "color", label: locale.diffColor },
    { value: "markers", label: locale.diffPlusMinus },
  ];

  return (
    <>
      <SettingGroup title={locale.advancedFontSizeGroup}>
        <SettingRow
          title={locale.uiFontSize}
          description={locale.uiFontSizeDescription}
          control={(
            <span className={advStyles.numberControl}>
              <input
                type="number"
                min={12}
                max={20}
                value={config.uiFontSize}
                aria-label={locale.uiFontSize}
                onChange={(event) => onUpdateConfig({ uiFontSize: Number(event.target.value) })}
              />
              <span>px</span>
            </span>
          )}
        />
        <SettingRow
          title={locale.codeFontSize}
          description={locale.codeFontSizeDescription}
          control={(
            <span className={advStyles.numberControl}>
              <input
                type="number"
                min={10}
                max={18}
                value={config.codeFontSize}
                aria-label={locale.codeFontSize}
                onChange={(event) => onUpdateConfig({ codeFontSize: Number(event.target.value) })}
              />
              <span>px</span>
            </span>
          )}
        />
      </SettingGroup>

      <SettingGroup title={locale.advancedFontGroup}>
        <SettingRow
          title={locale.uiFontWeight}
          control={(
            <ThemeSelect
              label={locale.uiFontWeight}
              value={config.uiFontWeight}
              options={[
                { value: "normal", label: locale.weightNormal },
                { value: "medium", label: locale.weightMedium },
                { value: "semibold", label: locale.weightSemibold },
              ] satisfies ThemeSelectOption<FontWeightId>[]}
              onChange={(uiFontWeight) => onUpdateConfig({ uiFontWeight })}
            />
          )}
        />
        <SettingRow
          title={locale.contentFont}
          control={(
            <ThemeSelect
              label={locale.contentFont}
              value={config.contentFont}
              options={[
                { value: "same", label: locale.contentFontSame },
                { value: "system", label: locale.motionSystem },
                { value: "serif", label: "Serif" },
              ] satisfies ThemeSelectOption<ContentFontId>[]}
              onChange={(contentFont) => onUpdateConfig({ contentFont })}
            />
          )}
        />
        <SettingRow
          title={locale.codeFont}
          control={(
            <ThemeSelect
              label={locale.codeFont}
              value={config.codeFont}
              options={[
                { value: "system", label: locale.motionSystem },
                { value: "jetbrains", label: "JetBrains Mono" },
                { value: "cascadia", label: "Cascadia Code" },
                { value: "consolas", label: "Consolas" },
              ] satisfies ThemeSelectOption<CodeFontId>[]}
              onChange={(codeFont) => onUpdateConfig({ codeFont })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={locale.advancedThemeGroup}>
        <SettingRow
          title={locale.separateLightDark}
          description={locale.separateLightDarkDescription}
          control={(
            <SettingSwitch
              label={locale.separateLightDark}
              checked={config.separateLightDark}
              onChange={(separateLightDark) => onUpdateConfig({ separateLightDark })}
            />
          )}
        />
        <SettingRow
          title={locale.translucentSidebar}
          control={(
            <SettingSwitch
              label={locale.translucentSidebar}
              checked={config.translucentSidebar}
              onChange={(translucentSidebar) => onUpdateConfig({ translucentSidebar })}
            />
          )}
        />
        <SettingRow
          title={locale.contrastLevel}
          control={(
            <span className={advStyles.sliderControl}>
              <input
                type="range"
                min={20}
                max={100}
                value={config.contrast}
                aria-label={locale.contrastLevel}
                onChange={(event) => onUpdateConfig({ contrast: Number(event.target.value) })}
              />
              <span>{config.contrast}</span>
            </span>
          )}
        />
        <SettingRow
          title={locale.diffMarker}
          description={locale.diffMarkerDescription}
          control={(
            <SettingSegmented
              label={locale.diffMarker}
              value={config.diffMarker}
              options={diffOptions}
              onChange={(diffMarker) => onUpdateConfig({ diffMarker })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={locale.advancedMotionGroup}>
        <SettingRow
          title={locale.reducedMotion}
          description={locale.reducedMotionDescription}
          control={(
            <SettingSegmented
              label={locale.reducedMotion}
              value={config.reducedMotion}
              options={motionOptions}
              onChange={(reducedMotion) => onUpdateConfig({ reducedMotion })}
            />
          )}
        />
        <SettingRow
          title={locale.pointerCursor}
          description={locale.pointerCursorDescription}
          control={(
            <SettingSwitch
              label={locale.pointerCursor}
              checked={config.pointerCursor}
              onChange={(pointerCursor) => onUpdateConfig({ pointerCursor })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}