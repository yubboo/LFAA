// 空画布中央引导与 5 大模板分类：点击主卡片后在其上下平滑弹出多张子模板卡片，点击即生成节点流。
import { useId, useState } from "react";
import { IconBulb, IconChevronDown, IconDeviceGamepad2, IconPointer2, IconScript, IconSparkles, IconSpeakerphone, IconTerminal2 } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import { CanvasTemplateOptions } from "./Canvas-Template-Options";
import { CANVAS_TEMPLATE_CATEGORIES, type CanvasSubTemplate } from "./template-catalog";
import styles from "./Canvas-Templates.module.css";

const categoryIcons = new Map([
  ["prompt-models", IconTerminal2], ["script-character", IconScript], ["commercial-ad", IconSpeakerphone],
  ["game-fanart", IconDeviceGamepad2], ["original-creation", IconBulb],
]);

export function CanvasTemplates({
  isZh,
  t,
  onSelectTemplate,
}: {
  isZh: boolean;
  t: CanvasLabels;
  onSelectTemplate: (template: CanvasSubTemplate) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const pointerGradient = useId();
  const optionProps = { isZh, infoId, onToggleInfo: (id: string) => setInfoId((prev) => prev === id ? null : id), onPick: onSelectTemplate };

  return (
    <div className={styles.overlay}>
      {/* 提示层透传鼠标，文字周围的空白区域也能双击打开节点菜单。 */}
      <p className={styles.hintRow}>
        <span>{t.createNodeGesture}</span>{" "}
        <IconPointer2 className={styles.hintPointer} size={34} color="var(--color-ink)" stroke={1.65} fill={`url(#${pointerGradient})`} aria-hidden="true">
          <defs>
            <linearGradient id={pointerGradient} x1="0" y1="0" x2="0.58" y2="0.92">
              <stop offset="3%" stopColor="var(--color-warning)" />
              <stop offset="25%" stopColor="var(--color-warning)" />
              <stop offset="42%" stopColor="var(--color-teal)" />
              <stop offset="58%" stopColor="var(--color-info)" />
              <stop offset="100%" stopColor="var(--color-link)" />
            </linearGradient>
          </defs>
        </IconPointer2>{" "}
        <span>{t.createNodeAction}</span>
      </p>

      <div className={styles.grid} role="list">
        {CANVAS_TEMPLATE_CATEGORIES.map((category) => {
          const isOpen = expandedId === category.id;
          const title = isZh ? category.titleZh : category.titleEn;
          const Icon = categoryIcons.get(category.id) ?? IconSparkles;

          return (
            <div key={category.id} className={styles.slot} data-expanded={isOpen ? "true" : undefined} role="listitem">
              {isOpen && <CanvasTemplateOptions {...optionProps} items={category.above} above />}

              <button
                type="button"
                className={styles.categoryCard}
                data-active={isOpen ? "true" : undefined}
                aria-expanded={isOpen}
                onClick={() => {
                  setExpandedId((prev) => (prev === category.id ? null : category.id));
                  setInfoId(null);
                }}
              >
                <span className={styles.catIcon} aria-hidden="true">
                  <Icon size={16} stroke={1.7} />
                </span>
                <span className={styles.catTitle}>{title}</span>
                <IconChevronDown className={styles.catArrow} size={14} stroke={1.7} aria-hidden="true" />
              </button>

              {isOpen && <CanvasTemplateOptions {...optionProps} items={category.below} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
