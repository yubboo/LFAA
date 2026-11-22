// 侧栏顶部的「新聊天」入口按钮，负责选中态样式与无障碍标记，点击行为由父级注入。
import { NavigationIcon } from "./NavigationIcon";
import styles from "./NavigationGroups.module.css";

/** 渲染顶部新聊天按钮；selected 表示当前已处于新聊天视图。 */
export function NavigationNewChatButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.newChat} ${selected ? styles.newChatActive : ""}`}
      type="button"
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
    >
      <NavigationIcon name="newChat" />
      <span>{label}</span>
    </button>
  );
}
