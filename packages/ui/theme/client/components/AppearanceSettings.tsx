// 呈现设置中心“外观”页面：模式预览、液态玻璃主题预设、强调色、背景/前景、字体与高级选项。
import { useRef, useState } from "react";
import { IconChevronDown, IconChevronRight, IconCopy, IconDownload } from "@tabler/icons-react";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import {
  THEME_PRESETS,
  normalizeHexColor,
  type AppearanceMode,
  type ThemePresetId,
  type UiFontId,
} from "../../contract/index";
import type { AppearanceSnapshot, AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { AccentSelect } from "./AccentSelect";
import { AppearanceAdvanced } from "./AppearanceAdvanced";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isZh = locale.isZh;

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

  const handleCopyTheme = async () => {
    const json = exportThemeJson();
    try {
      await navigator.clipboard.writeText(json);
      setNotice(locale.themeCopied);
    } catch {
      setNotice(locale.themeCopied);
    }
    window.setTimeout(() => setNotice(""), 2400);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const ok = importThemeJson(text);
    setNotice(ok ? "" : locale.themeImportInvalid);
  };

  return (
    <section className={styles.page} aria-labelledby="appearance-title">
      <header className={styles.heading}>
        <h2 id="appearance-title">{locale.appearance}</h2>
        <p>{locale.themeDescription}</p>
      </header>

      <div className={styles.sectionHeader}>
        <h3>{locale.visualStyle}</h3>
        {notice && <span className={styles.notice} role="status">{notice}</span>}
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.themeMode}</strong>
          </div>
          <div className={styles.modePills} role="radiogroup" aria-label={locale.theme}>
            {modeOptions.map((option) => {
              const selected = mode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  className={`${styles.modePill} ${selected ? styles.modePillSelected : ""}`}
                  onClick={() => setMode(option.mode)}
                >
                  <span className={styles.preview} data-preview={option.mode} aria-hidden="true">
                    <span className={styles.previewRail} />
                    <span className={styles.previewSidebar} />
                    <span className={styles.previewCanvas}>
                      <span />
                      <span />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.theme}</strong>
          </div>
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
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.accentColor}</strong>
          </div>
          <AccentSelect
            locale={locale}
            accent={activeVariant.accent}
            customAccent={activeVariant.customAccent}
            resolvedScheme={resolvedScheme}
            onSelectAccent={(accent) => updateVariant({ accent })}
            onCustomAccentChange={(hex) => updateVariant({ accent: "custom", customAccent: hex })}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.backgroundColor}</strong>
          </div>
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
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.foregroundColor}</strong>
          </div>
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
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.uiFont}</strong>
          </div>
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
        </div>
      </div>

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
    </section>
  );
}
