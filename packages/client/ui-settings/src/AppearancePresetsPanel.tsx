/**
 * 功能：呈现外观预设库。
 * 作用：展示内置与当前账户自定义预设，支持先应用后自定义另存，以及恢复默认。
 * 关联文件：SettingsPage.tsx、AppearancePresetFile.ts、util/values/src/appearance-presets.ts。
 */
import { useRef, useState } from "react";
import { Alert, Button, Input, Modal, Popconfirm, Tag, Typography } from "antd";
import { appearanceBackgroundOptions } from "lfaa-util-values/src/builtin-backgrounds.js";
import { APPEARANCE_PRESET_LIMIT, APPEARANCE_PRESET_NAME_MAX_LENGTH, type AppearancePreset, type UserSettings } from "lfaa-util-values/src/settings-contract.js";
import { appearancePresetMatchesCurrent, BUILTIN_APPEARANCE_PRESETS } from "lfaa-util-values/src/appearance-presets.js";
import type { AppearanceBackground } from "lfaa-client-connection/src/api.js";

export interface AppearancePresetsPanelProps {
  settings: UserSettings;
  resolvedTheme: "light" | "dark";
  uploadedBackgrounds: AppearanceBackground[];
  busy: boolean;
  onSaveCurrent: (name: string) => Promise<void>;
  onApply: (preset: AppearancePreset) => Promise<void>;
  onDelete: (preset: AppearancePreset) => Promise<void>;
  onExport: (preset: AppearancePreset) => Promise<void>;
  onImport: (file: File) => Promise<void>;
}

const navigationLayouts = {
  "left-two-column": "左右布局",
  "three-column": "三列布局",
  "right-tools": "工作区 + 工具",
  focus: "专注模式"
} as const;

function presetAccent(preset: AppearancePreset, resolvedTheme: "light" | "dark"): string {
  const appearance = preset.snapshot.appearance;
  const mode = appearance.theme === "dark" ? "dark" : appearance.theme === "light" ? "light" : resolvedTheme;
  return appearance.advanced.separateModes ? appearance.advanced.modeStyles[mode].accentColor : appearance.accentColor;
}

function previewBackground(preset: AppearancePreset, uploadedBackgrounds: AppearanceBackground[]): string | undefined {
  const id = preset.snapshot.appearance.backgrounds.appCenter;
  if (id === "none") return undefined;
  const uploaded = uploadedBackgrounds.find((background) => background.id === id)?.url;
  if (uploaded) return uploaded;
  const builtIn = appearanceBackgroundOptions.find((background) => background.id === id);
  return builtIn && "file" in builtIn ? builtIn.file : undefined;
}

function PresetPreview({ preset, accent, background }: { preset: AppearancePreset; accent: string; background?: string }) {
  const isDark = preset.snapshot.appearance.theme === "dark";
  return <div className={`appearance-preset-preview${isDark ? " is-dark" : ""}`} data-layout={preset.snapshot.general.navigationLayout} aria-hidden="true">
    {background ? <img className="appearance-preset-preview__background" src={background} alt="" loading="lazy" decoding="async" /> : null}
    <span className="appearance-preset-preview__wash" style={{ opacity: preset.snapshot.appearance.overlay / 100 }} />
    <div className="appearance-preset-preview__window">
      <div className="appearance-preset-preview__bar"><i style={{ backgroundColor: accent }} /><i /><i /></div>
      <div className="appearance-preset-preview__body">
        <div className="appearance-preset-preview__sidebar"><i style={{ backgroundColor: accent }} /><i /><i /></div>
        <div className="appearance-preset-preview__content"><i style={{ backgroundColor: accent }} /><i /><i /></div>
      </div>
    </div>
  </div>;
}

export function AppearancePresetsPanel({ settings, resolvedTheme, uploadedBackgrounds, busy, onSaveCurrent, onApply, onDelete, onExport, onImport }: AppearancePresetsPanelProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customPresets = settings.appearance.presets;
  const canAddPreset = customPresets.length < APPEARANCE_PRESET_LIMIT;

  async function saveCurrent(): Promise<void> {
    const name = nameDraft.trim();
    if (!name) return;
    setError("");
    try {
      await onSaveCurrent(name);
      setNameDraft("");
      setSaveModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "预设保存失败，请稍后重试。");
    }
  }

  async function applyPreset(preset: AppearancePreset): Promise<void> {
    setError("");
    setPendingPresetId(preset.id);
    try { await onApply(preset); }
    catch (applyError) { setError(applyError instanceof Error ? applyError.message : "预设应用失败，请稍后重试。"); }
    finally { setPendingPresetId(null); }
  }

  async function deletePreset(preset: AppearancePreset): Promise<void> {
    setError("");
    setPendingPresetId(preset.id);
    try { await onDelete(preset); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "预设删除失败，请稍后重试。"); }
    finally { setPendingPresetId(null); }
  }

  async function exportPreset(preset: AppearancePreset): Promise<void> {
    setError("");
    setPendingPresetId(preset.id);
    try { await onExport(preset); }
    catch (exportError) { setError(exportError instanceof Error ? exportError.message : "预设导出失败，请稍后重试。"); }
    finally { setPendingPresetId(null); }
  }

  async function importFile(file: File): Promise<void> {
    setError("");
    try { await onImport(file); }
    catch (importError) { setError(importError instanceof Error ? importError.message : "预设导入失败，请稍后重试。"); }
  }

  function renderPreset(preset: AppearancePreset, builtIn: boolean) {
    const active = appearancePresetMatchesCurrent(settings, preset.snapshot);
    const accent = presetAccent(preset, resolvedTheme);
    const background = previewBackground(preset, uploadedBackgrounds);
    const pending = busy || pendingPresetId === preset.id;
    const applyLabel = preset.id === "builtin-standard" ? "恢复默认" : active ? "重新应用" : "应用预设";
    return <article className={`appearance-preset-card${active ? " is-active" : ""}`} key={preset.id}>
      <PresetPreview preset={preset} accent={accent} background={background} />
      <div className="appearance-preset-card__content">
        <div className="appearance-preset-card__heading">
          <div><h3>{preset.name}</h3><p>{preset.description}</p></div>
          {active ? <Tag color="blue">当前外观</Tag> : null}
        </div>
        <div className="appearance-preset-card__details" aria-label={`${preset.name}预设摘要`}>
          <span>{preset.snapshot.appearance.theme === "dark" ? "深色" : preset.snapshot.appearance.theme === "light" ? "浅色" : "跟随系统"}</span>
          <span>{navigationLayouts[preset.snapshot.general.navigationLayout]}</span>
          <span className="appearance-preset-card__accent"><i style={{ backgroundColor: accent }} />{accent}</span>
        </div>
        <div className="appearance-preset-card__actions">
          <Button type={active ? "default" : "primary"} aria-pressed={active} loading={pending && pendingPresetId === preset.id} disabled={busy} onClick={() => void applyPreset(preset)}>{applyLabel}</Button>
          <Button loading={pending && pendingPresetId === preset.id} disabled={busy} onClick={() => void exportPreset(preset)}>导出</Button>
          {!builtIn ? <Popconfirm title="删除这个自定义预设？" description="只删除预设记录，不会删除背景图片或修改当前外观。" okText="删除" cancelText="取消" onConfirm={() => void deletePreset(preset)}>
            <Button disabled={busy || pendingPresetId === preset.id}>删除</Button>
          </Popconfirm> : null}
        </div>
      </div>
    </article>;
  }

  return <div className="appearance-presets-panel">
    <header className="appearance-presets-panel__header">
      <div><Typography.Title level={3}>外观预设</Typography.Title><Typography.Paragraph>内置预设可以先应用，再到“外观设置”继续调整；完成后点“保存当前外观”另存为我的预设，原预设不会被覆盖。点击“恢复默认”可还原常规外观与工作台布局；通知、文件夹、快捷键和权限保持原样。</Typography.Paragraph></div>
      <div className="appearance-presets-panel__toolbar">
        <Button disabled={busy || !canAddPreset} onClick={() => fileInputRef.current?.click()}>导入预设</Button>
        <Button disabled={busy || !canAddPreset} onClick={() => { setError(""); setSaveModalOpen(true); }}>保存当前外观</Button>
        <Typography.Text type="secondary">{customPresets.length}/{APPEARANCE_PRESET_LIMIT} 个自定义预设</Typography.Text>
        <input ref={fileInputRef} className="appearance-presets-panel__file-input" type="file" accept=".lfaa-preset,application/vnd.lfaa.appearance-preset" aria-label="导入外观预设文件" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importFile(file);
        }} />
      </div>
    </header>
    {error ? <Alert className="appearance-presets-panel__error" type="error" showIcon message={error} /> : null}
    {!canAddPreset ? <Alert type="info" showIcon message="已达到自定义预设上限" description="删除不再使用的自定义预设后，可以继续保存或导入。" /> : null}
    <section className="appearance-presets-group" aria-labelledby="appearance-presets-builtin-heading">
      <div className="appearance-presets-group__heading"><div><h3 id="appearance-presets-builtin-heading">内置预设</h3><p>可随时应用；不会改写系统默认值。</p></div></div>
      <div className="appearance-presets-grid">{BUILTIN_APPEARANCE_PRESETS.map((preset) => renderPreset(preset, true))}</div>
    </section>
    <section className="appearance-presets-group" aria-labelledby="appearance-presets-custom-heading">
      <div className="appearance-presets-group__heading"><div><h3 id="appearance-presets-custom-heading">我的预设</h3><p>保存当前外观与常规布局，便于之后一键恢复。</p></div></div>
      {customPresets.length ? <div className="appearance-presets-grid">{customPresets.map((preset) => renderPreset(preset, false))}</div> : <div className="appearance-presets-empty"><strong>还没有自定义预设</strong><span>先在“外观设置”中调整，再保存为预设。</span></div>}
    </section>
    <Modal
      title="保存为外观预设"
      open={saveModalOpen}
      okText="保存预设"
      cancelText="取消"
      okButtonProps={{ disabled: !nameDraft.trim() || busy, loading: busy }}
      onCancel={() => { if (!busy) setSaveModalOpen(false); }}
      onOk={() => void saveCurrent()}
      destroyOnClose
    >
      <label className="appearance-presets-name-field"><span>预设名称</span><Input autoFocus maxLength={APPEARANCE_PRESET_NAME_MAX_LENGTH} value={nameDraft} aria-label="预设名称" placeholder="例如：深色专注布局" onChange={(event) => setNameDraft(event.target.value)} onPressEnter={() => void saveCurrent()} /></label>
      <p className="appearance-presets-name-hint">会保存当前主题、各区域背景与效果、字体、对比度、动效和工作台布局，不保存文件夹、权限或通知设置。</p>
    </Modal>
  </div>;
}
