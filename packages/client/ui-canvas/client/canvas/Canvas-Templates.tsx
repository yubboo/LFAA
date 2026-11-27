// 空画布中央引导与 5 大模板分类：点击主卡片后在其上下平滑弹出多张子模板卡片，点击即生成节点流。
import { useState } from "react";
import { IconInfoCircle, IconPlayerPlayFilled, IconSparkles } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import { CANVAS_TEMPLATE_CATEGORIES, type CanvasSubTemplate } from "./template-catalog";
import styles from "./Canvas-Templates.module.css";

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

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setExpandedId(null);
          setInfoId(null);
        }
      }}
    >
      <div className={styles.hintRow}>
        <IconPlayerPlayFilled size={11} className={styles.hintIcon} />
        <span className={styles.hintText}>{t.createNodeHint}</span>
      </div>

      <div className={styles.grid} role="list">
        {CANVAS_TEMPLATE_CATEGORIES.map((category) => {
          const isOpen = expandedId === category.id;
          const title = isZh ? category.titleZh : category.titleEn;

          return (
            <div key={category.id} className={styles.slot} data-expanded={isOpen ? "true" : undefined} role="listitem">
              {isOpen && category.above.length > 0 && (
                <div className={`${styles.stack} ${styles.stackAbove}`}>
                  {category.above.map((item) => (
                    <SubCard
                      key={item.id}
                      item={item}
                      isZh={isZh}
                      showInfo={infoId === item.id}
                      onToggleInfo={() => setInfoId((prev) => (prev === item.id ? null : item.id))}
                      onPick={() => onSelectTemplate(item)}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                className={styles.categoryCard}
                data-active={isOpen ? "true" : undefined}
                aria-expanded={isOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedId((prev) => (prev === category.id ? null : category.id));
                  setInfoId(null);
                }}
              >
                <span className={styles.catIcon} aria-hidden="true">
                  <IconSparkles size={15} stroke={1.7} />
                </span>
                <span className={styles.catTitle}>{title}</span>
                <span className={styles.catDeco} aria-hidden="true" />
              </button>

              {isOpen && category.below.length > 0 && (
                <div className={`${styles.stack} ${styles.stackBelow}`}>
                  {category.below.map((item) => (
                    <SubCard
                      key={item.id}
                      item={item}
                      isZh={isZh}
                      showInfo={infoId === item.id}
                      onToggleInfo={() => setInfoId((prev) => (prev === item.id ? null : item.id))}
                      onPick={() => onSelectTemplate(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubCard({
  item,
  isZh,
  showInfo,
  onToggleInfo,
  onPick,
}: {
  item: CanvasSubTemplate;
  isZh: boolean;
  showInfo: boolean;
  onToggleInfo: () => void;
  onPick: () => void;
}) {
  const title = isZh ? item.titleZh : item.titleEn;
  const summary = isZh ? item.summaryZh : item.summaryEn;

  return (
    <div className={styles.subWrap}>
      <div
        className={styles.subCard}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onPick();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPick();
          }
        }}
      >
        <span className={styles.subThumb} data-tone={item.accent} aria-hidden="true">
          <IconSparkles size={14} stroke={1.8} />
        </span>
        <span className={styles.subTitle} title={title}>{title}</span>
        <button
          type="button"
          className={styles.infoBtn}
          aria-label={summary}
          title={summary}
          onClick={(event) => {
            event.stopPropagation();
            onToggleInfo();
          }}
        >
          <IconInfoCircle size={15} stroke={1.7} />
        </button>
      </div>
      {showInfo && <div className={styles.infoBubble}>{summary}</div>}
    </div>
  );
}
