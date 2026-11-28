// 中间区域顶栏盒子：对话 / 轨迹视图切换与右侧协作 Agent 成员入口。
import type { ReactNode } from "react";
import styles from "./ChatTopBar.module.css";

/** 渲染中央工作区顶部的视图切换条与协作成员入口；空会话时仅展示右侧成员入口。 */
export function ChatTopBar({
  view,
  onChange,
  isZh,
  showTabs = true,
  rightSlot,
}: {
  view: "chat" | "trace";
  onChange: (view: "chat" | "trace") => void;
  isZh: boolean;
  showTabs?: boolean;
  rightSlot?: ReactNode;
}) {
  return (
    <div className={`${styles.bar} ${showTabs ? styles.barBordered : ""}`}>
      {showTabs ? (
        <nav className={styles.tabs} aria-label={isZh ? "会话视图" : "Conversation views"}>
          <button type="button" aria-current={view === "chat" ? "page" : undefined} onClick={() => onChange("chat")}>
            {isZh ? "对话" : "Chat"}
          </button>
          <button type="button" aria-current={view === "trace" ? "page" : undefined} onClick={() => onChange("trace")}>
            {isZh ? "轨迹" : "Trace"}
          </button>
        </nav>
      ) : <span />}
      {rightSlot}
    </div>
  );
}