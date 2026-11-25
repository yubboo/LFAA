// 追问建议卡片：与回复同一条消息里给出的下一步短句，点击即以该句作为下一条消息发送。
import { useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import styles from "./SuggestionChips.module.css";

/** 渲染建议胶囊；没有建议时不占位。点击过的建议立即置灰并禁用，避免重复发送。 */
export function SuggestionChips({
  suggestions,
  onSelect,
}: {
  suggestions: ReadonlyArray<string>;
  onSelect: (text: string) => void;
}) {
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  if (suggestions.length === 0) return null;
  return (
    <div className={styles.list}>
      {suggestions.map((text, index) => {
        const used = sent.has(text);
        return (
          <button
            key={`${index}-${text}`}
            type="button"
            className={styles.chip}
            disabled={used}
            data-used={used ? "true" : undefined}
            onClick={() => {
              if (used) return;
              setSent((prev) => new Set(prev).add(text));
              onSelect(text);
            }}
          >
            <span className={styles.text}>{text}</span>
            <IconArrowRight size={14} stroke={1.8} className={styles.arrow} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}