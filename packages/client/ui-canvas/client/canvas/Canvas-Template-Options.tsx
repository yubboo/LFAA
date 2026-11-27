// 空画布分类展开后的模板项，分离应用模板和阅读说明的键盘入口。
import { IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import type { CanvasSubTemplate } from "./template-catalog";
import styles from "./Canvas-Template-Options.module.css";

export function CanvasTemplateOptions({ items, above, isZh, infoId, onToggleInfo, onPick }: {
  items: CanvasSubTemplate[];
  above?: boolean;
  isZh: boolean;
  infoId: string | null;
  onToggleInfo: (id: string) => void;
  onPick: (item: CanvasSubTemplate) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`${styles.stack} ${above ? styles.stackAbove : styles.stackBelow}`}>
      {items.map((item) => {
        const title = isZh ? item.titleZh : item.titleEn;
        const summary = isZh ? item.summaryZh : item.summaryEn;
        const showInfo = infoId === item.id;
        return (
          <div key={item.id} className={styles.subWrap}>
            <div className={styles.subCard}>
              <button type="button" className={styles.subPick} onClick={() => onPick(item)}>
                <span className={styles.subThumb} data-tone={item.accent} aria-hidden="true"><IconSparkles size={14} stroke={1.8} /></span>
                <span className={styles.subTitle} title={title}>{title}</span>
              </button>
              <button type="button" className={styles.infoBtn} aria-label={summary} aria-expanded={showInfo} title={summary} onClick={() => onToggleInfo(item.id)}>
                <IconInfoCircle size={15} stroke={1.7} aria-hidden="true" />
              </button>
            </div>
            {showInfo && <div className={styles.infoBubble}>{summary}</div>}
          </div>
        );
      })}
    </div>
  );
}
