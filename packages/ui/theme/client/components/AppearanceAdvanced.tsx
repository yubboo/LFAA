// 呈现外观设置页的可折叠“高级”分组：字号、动态效果、独立明暗、侧边栏半透明与对比度等实时调节。
import type {
  AppearanceConfig,
  CodeFontId,
  ContentFontId,
  DiffMarkerMode,
  FontWeightId,
  ReducedMotionMode,
} from "../../src/index";
import type { ThemeLocaleMessages } from "../locales";
import { ThemeSelect, type ThemeSelectOption } from "./ThemeSelect";
import advStyles from "./AppearanceAdvanced.module.css";
import styles from "./AppearanceSettings.module.css";

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
    <div className={advStyles.advancedStack}>
      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.uiFontSize}</strong>
            <small>{locale.uiFontSizeDescription}</small>
          </div>
          <div className={advStyles.numberControl}>
            <input
              type="number"
              min={12}
              max={20}
              value={config.uiFontSize}
              aria-label={locale.uiFontSize}
              onChange={(event) => onUpdateConfig({ uiFontSize: Number(event.target.value) })}
            />
            <span>px</span>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.codeFontSize}</strong>
            <small>{locale.codeFontSizeDescription}</small>
          </div>
          <div className={advStyles.numberControl}>
            <input
              type="number"
              min={10}
              max={18}
              value={config.codeFontSize}
              aria-label={locale.codeFontSize}
              onChange={(event) => onUpdateConfig({ codeFontSize: Number(event.target.value) })}
            />
            <span>px</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.reducedMotion}</strong>
            <small>{locale.reducedMotionDescription}</small>
          </div>
          <div className={advStyles.segmented} role="radiogroup" aria-label={locale.reducedMotion}>
            {motionOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={config.reducedMotion === item.value}
                className={config.reducedMotion === item.value ? advStyles.segmentedActive : ""}
                onClick={() => onUpdateConfig({ reducedMotion: item.value })}
              >{item.label}</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.separateLightDark}</strong>
            <small>{locale.separateLightDarkDescription}</small>
          </div>
          <SwitchToggle
            label={locale.separateLightDark}
            checked={config.separateLightDark}
            onChange={(checked) => onUpdateConfig({ separateLightDark: checked })}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.uiFontWeight}</strong>
          </div>
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
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.contentFont}</strong>
          </div>
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
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.codeFont}</strong>
          </div>
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
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.translucentSidebar}</strong>
          </div>
          <SwitchToggle
            label={locale.translucentSidebar}
            checked={config.translucentSidebar}
            onChange={(checked) => onUpdateConfig({ translucentSidebar: checked })}
          />
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.contrastLevel}</strong>
          </div>
          <div className={advStyles.sliderControl}>
            <input
              type="range"
              min={20}
              max={100}
              value={config.contrast}
              aria-label={locale.contrastLevel}
              onChange={(event) => onUpdateConfig({ contrast: Number(event.target.value) })}
            />
            <span>{config.contrast}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.diffMarker}</strong>
            <small>{locale.diffMarkerDescription}</small>
          </div>
          <div className={advStyles.segmented} role="radiogroup" aria-label={locale.diffMarker}>
            {diffOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={config.diffMarker === item.value}
                className={config.diffMarker === item.value ? advStyles.segmentedActive : ""}
                onClick={() => onUpdateConfig({ diffMarker: item.value })}
              >{item.label}</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>{locale.pointerCursor}</strong>
            <small>{locale.pointerCursorDescription}</small>
          </div>
          <SwitchToggle
            label={locale.pointerCursor}
            checked={config.pointerCursor}
            onChange={(checked) => onUpdateConfig({ pointerCursor: checked })}
          />
        </div>
      </div>
    </div>
  );
}

function SwitchToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${advStyles.switch} ${checked ? advStyles.switchOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={advStyles.switchThumb} />
    </button>
  );
}
