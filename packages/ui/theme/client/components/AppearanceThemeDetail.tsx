// 外观设置「高级」里的主题细项：主题预设（含导入/复制）、强调色、背景、前景与界面字体。
// 从主区收进高级后仍沿用设置中心的行式结构，控件形态与生效方式与原先一致。
import { useEffect, useRef, useState } from "react";
import { IconCopy, IconDownload } from "@tabler/icons-react";
import {
  SettingGroup,
  SettingRow,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import {
  THEME_PRESETS,
  normalizeHexColor,
  type ThemePresetId,
  type UiFontId,
} from "../../contract/index";
import type { AppearanceSnapshot, AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { AccentSelect } from "./AccentSelect";
import { ThemeSelect, type ThemeSelectOption } from "./ThemeSelect";
import styles from "./AppearanceThemeDetail.module.css";

/** 渲染主题细项，并把主题 JSON 的导入/复制结果作为组内状态提示。 */
export function AppearanceThemeDetail({
  locale,
  store,
  snapshot,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  snapshot: AppearanceSnapshot;
}) {
  const { config, resolvedScheme, activeVariant } = snapshot;
  const { applyThemeLook, updateVariant, exportThemeJson, importThemeJson } = store;

  const [notice, setNotice] = useState("");
  const [bgInput, setBgInput] = useState(activeVariant.background);
  const [fgInput, setFgInput] = useState(activeVariant.foreground);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZh = locale.isZh;

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  // 外部切换明暗、应用预设或导入主题后，把色值输入框同步到当前变体。
  if (bgInput.toUpperCase() !== activeVariant.background.toUpperCase() && /^#[0-9a-fA-F]{6}$/u.test(bgInput)) {
    setBgInput(activeVariant.background);
  }
  if (fgInput.toUpperCase() !== activeVariant.foreground.toUpperCase() && /^#[0-9a-fA-F]{6}$/u.test(fgInput)) {
    setFgInput(activeVariant.foreground);
  }

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
    <SettingGroup title={locale.themeDetails} description={locale.themeDetailsDesc}>
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
                applyThemeLook(nextPreset, { kind: "default" });
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

      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}
    </SettingGroup>
  );
}