// 三条建议盒子：空会话引导区下方那一行建议，独立成件，改动它不会牵动会话区与输入区。
import { IconCircleCheck } from "@tabler/icons-react";
import heroStyles from "./ChatWorkspace.hero.module.css";

/** 渲染三条起步建议；样式与尺寸只在这里的类上，调用方只决定「显示哪三条」。 */
export function ChatSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className={heroStyles.heroSuggestions} role="list">
      {suggestions.map((prompt) => (
        <button
          key={prompt}
          type="button"
          role="listitem"
          className={heroStyles.heroSuggestionBtn}
          onClick={() => onPick(prompt)}
        >
          <IconCircleCheck className={heroStyles.heroSuggestionIcon} size={15} stroke={1.6} aria-hidden="true" />
          <span className={heroStyles.heroSuggestionText}>{prompt}</span>
        </button>
      ))}
    </div>
  );
}