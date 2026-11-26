// 中间区域顶栏盒子：只管「对话 / 轨迹」两个视图入口与它自己的外壳，位置与会话区、输入区互不影响。
import styles from "./ChatTopBar.module.css";

/** 渲染中央工作区顶部的视图切换条；选中态由 aria-current 表达，样式留在本盒子内。 */
export function ChatTopBar({
  view,
  onChange,
  isZh,
}: {
  view: "chat" | "trace";
  onChange: (view: "chat" | "trace") => void;
  isZh: boolean;
}) {
  return (
    <nav className={styles.tabs} aria-label={isZh ? "会话视图" : "Conversation views"}>
      <button type="button" aria-current={view === "chat" ? "page" : undefined} onClick={() => onChange("chat")}>
        {isZh ? "对话" : "Chat"}
      </button>
      <button type="button" aria-current={view === "trace" ? "page" : undefined} onClick={() => onChange("trace")}>
        {isZh ? "轨迹" : "Trace"}
      </button>
    </nav>
  );
}