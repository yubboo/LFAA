// 输入卡片内部一体化的「技能 / 插件」搜索结果面板与底栏触发按钮。
// 关联：packages/client/ui-chat/client/composer/ChatComposer.tsx；运行环境：浏览器。
import { useEffect, useRef } from "react";
import {
  IconAdjustmentsHorizontal,
  IconArrowUpRight,
  IconAt,
  IconBrandChrome,
  IconBrush,
  IconChevronRight,
  IconEdit,
  IconFolder,
  IconListCheck,
  IconPaperclip,
  IconPhoto,
  IconPlugConnected,
  IconPlus,
  IconStack2,
  IconTarget,
} from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import {
  splitHighlightParts,
  type CapabilityEntry,
  type CapabilityMode,
  type CapabilitySection,
} from "./composer-capabilities";
import styles from "./ComposerCapabilityPanel.module.css";

function renderEntryIcon(entry: CapabilityEntry) {
  if (entry.kind === "plugin") return <IconPlugConnected size={15} stroke={1.8} className={styles.iconPlugin} aria-hidden="true" />;
  if (entry.kind === "skill") return <IconStack2 size={15} stroke={1.8} className={styles.iconSkill} aria-hidden="true" />;
  if (entry.actionId === "plan") return <IconListCheck size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "goal") return <IconTarget size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "canvas") return <IconBrush size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "add-plugin") return <IconPlus size={15} stroke={1.9} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "manage-plugins") return <IconAdjustmentsHorizontal size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "pick-file") return <IconPaperclip size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "pick-folder" || entry.actionId === "pick-project") return <IconFolder size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "pick-media") return <IconPhoto size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "trigger-mention") return <IconAt size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "trigger-slash") return <IconEdit size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  if (entry.actionId === "open-browser") return <IconBrandChrome size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
  return <IconStack2 size={15} stroke={1.8} className={styles.iconAction} aria-hidden="true" />;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const parts = splitHighlightParts(text, query);
  return (
    <>
      {parts.map((part, index) => (
        part.match
          ? <span key={index} className={styles.matchText}>{part.text}</span>
          : <span key={index}>{part.text}</span>
      ))}
    </>
  );
}

/** 输入卡片顶部内联展开的「技能 / 插件」搜索结果区，与下方主输入框无缝融合。 */
export function ComposerCapabilityPanel({
  mode,
  isZh,
  query,
  sections,
  flatEntries,
  activeIndex,
  onHoverIndex,
  onSelect,
}: {
  mode: CapabilityMode;
  isZh: boolean;
  query: string;
  sections: readonly CapabilitySection[];
  flatEntries: readonly CapabilityEntry[];
  activeIndex: number;
  onHoverIndex: (index: number) => void;
  onSelect: (entry: CapabilityEntry) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const indexByKey = new Map(flatEntries.map((entry, idx) => [entry.key, idx]));

  return (
    <div
      className={styles.panel}
      role="listbox"
      aria-label={mode === "skill" ? (isZh ? "选择技能" : "Select skill") : mode === "plugin" ? (isZh ? "选择插件" : "Select plugin") : (isZh ? "添加上下文" : "Add context")}
    >
      {sections.length === 0 ? (
        <div className={styles.empty}>
          {query.trim()
            ? (isZh ? `未找到匹配「${query.trim()}」的${mode === "skill" ? "技能" : "插件"}` : `No matching ${mode}s`)
            : (mode === "skill"
              ? (isZh ? "暂无已启用的技能" : "No enabled skills")
              : (isZh ? "暂无已安装的插件" : "No installed plugins"))}
        </div>
      ) : (
        sections.map((section, sectionIdx) => (
          <div key={section.id} className={styles.section}>
            {section.label
              ? <div className={styles.sectionTitle}>{section.label}</div>
              : (sectionIdx > 0 && <div className={styles.overflowDivider} />)}
            {section.items.map((entry) => {
              const idx = indexByKey.get(entry.key) ?? -1;
              const isActive = idx === activeIndex;
              const isExternalLink = entry.actionId === "add-plugin" || entry.actionId === "manage-plugins";
              return (
                <button
                  key={entry.key}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={styles.row}
                  data-active={isActive ? "true" : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => { if (idx >= 0) onHoverIndex(idx); }}
                  onClick={() => onSelect(entry)}
                >
                  {renderEntryIcon(entry)}
                  <span className={styles.rowTitle}>
                    <HighlightText text={entry.title} query={query} />
                  </span>
                  {entry.description && (
                    <span className={styles.rowDesc}>
                      <HighlightText text={entry.description} query={query} />
                    </span>
                  )}
                  {isExternalLink && <IconArrowUpRight size={14} stroke={1.8} className={styles.rowLinkIcon} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

/** 底栏「技能」「插件」快捷触发按钮，窄容器下自动折叠文字仅保留图标 + 悬停提示。 */
export function ComposerCapabilityTriggers({
  isZh,
  activeMode,
  onToggleMode,
}: {
  isZh: boolean;
  activeMode: CapabilityMode | null;
  onToggleMode: (mode: CapabilityMode) => void;
}) {
  const skillLabel = isZh ? "技能" : "Skills";
  const pluginLabel = isZh ? "插件" : "Plugins";

  return (
    <>
      <HoverTip label={skillLabel}>
        <button
          type="button"
          className={styles.triggerBtn}
          data-active={activeMode === "skill" ? "true" : undefined}
          aria-expanded={activeMode === "skill"}
          aria-label={skillLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onToggleMode("skill")}
        >
          <IconStack2 size={14} stroke={1.8} aria-hidden="true" />
          <span className={styles.triggerLabel}>{skillLabel}</span>
          <IconChevronRight size={12} stroke={1.8} className={styles.triggerChevron} aria-hidden="true" />
        </button>
      </HoverTip>

      <HoverTip label={pluginLabel}>
        <button
          type="button"
          className={styles.triggerBtn}
          data-active={activeMode === "plugin" ? "true" : undefined}
          aria-expanded={activeMode === "plugin"}
          aria-label={pluginLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onToggleMode("plugin")}
        >
          <IconPlugConnected size={14} stroke={1.8} aria-hidden="true" />
          <span className={styles.triggerLabel}>{pluginLabel}</span>
          <IconChevronRight size={12} stroke={1.8} className={styles.triggerChevron} aria-hidden="true" />
        </button>
      </HoverTip>
    </>
  );
}
