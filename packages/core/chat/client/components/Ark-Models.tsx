// 浏览器端方舟公开模型目录，嵌入套餐配置表单并与 Host 共用模型契约。
import { getArkPlanCatalog, type ArkPlanKind } from "@lfaa/llm/ark-plan";
import { arkModelMessages } from "../locales";
import styles from "./Ark-Models.module.css";
import formStyles from "./ModelProviderGrid.module.css";

/** 展示套餐的模型分类，选择语言模型时回填配置表单的模型 ID。 */
export function ArkModels({ plan, model, isZh, onSelect }: {
  plan: ArkPlanKind;
  model: string;
  isZh: boolean;
  onSelect: (id: string) => void;
}) {
  const { chatModels, otherGroups } = getArkPlanCatalog(plan);
  const labels = arkModelMessages[isZh ? "zh" : "en"];

  return (
    <div className={styles.catalog}>
      <span className={formStyles.fieldHint}>{labels.source}</span>
      {/* 语言模型可用于聊天，所以用按钮写入模型 ID。 */}
      <section aria-label={labels.chat} className={styles.group}>
        <h3>{labels.chat}</h3>
        <div className={formStyles.chipsRow}>
          {chatModels.map(({ id, status }) => {
            const selected = model.trim().toLowerCase() === id;
            return (
              <button
                key={id}
                type="button"
                className={`${formStyles.chipBtn} ${selected ? formStyles.chipBtnActive : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(id)}
              >
                <span>{id}</span>
                {status && <small>{labels[status]}</small>}
              </button>
            );
          })}
        </div>
      </section>
      {/* 向量、视觉和语音模型仅供查阅，语音同时列出调用协议使用的资源 ID。 */}
      {otherGroups.map(({ kind, models }) => (
        <section key={kind} aria-label={labels[kind]} className={styles.group}>
          <h3>{labels[kind]}</h3>
          <ul className={styles.ids}>
            {models.map(({ id, resourceId }) => (
              <li key={id}>
                <code>{id}</code>
                {resourceId && <small>{labels.resource} <code>{resourceId}</code></small>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
