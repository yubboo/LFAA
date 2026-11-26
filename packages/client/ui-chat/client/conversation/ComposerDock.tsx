// 输入框大盒子：提示条、回到底部、交接条、任务盒子、目标盒子与输入卡片都在这一行里，不再叠在正文上。
import type { ReactNode, RefObject } from "react";
import { IconArrowDown } from "@tabler/icons-react";
import type { ChatGoalItem } from "../store/chat-types";
import { SessionBars } from "../session/SessionBars";
import type { SessionTodo } from "../session/session-todos";
import styles from "./ComposerDock.module.css";

/**
 * 渲染输入区。盒子自己只负责这一行的排版与命中，正文滚动、消息渲染都由会话区盒子负责，
 * 所以这里不需要遮罩，也不会再出现「整块底色盖在白板上」的问题。
 */
export function ComposerDock({
  dockRef,
  isZh,
  view,
  todos,
  paused,
  settled,
  goal,
  showScrollBottom,
  onScrollToLatest,
  onEditGoal,
  onToggleGoalAuto,
  notices,
  children,
}: {
  dockRef: RefObject<HTMLDivElement | null>;
  isZh: boolean;
  view: "chat" | "trace";
  todos: readonly SessionTodo[] | null;
  paused: boolean;
  settled: boolean;
  goal: ChatGoalItem | null | undefined;
  showScrollBottom: boolean;
  onScrollToLatest: () => void;
  onEditGoal: (objective: string) => Promise<boolean>;
  onToggleGoalAuto: (next: boolean) => Promise<boolean>;
  /** 错误条、流式提示、交接条：由外层按 Store 状态算好后交进来。 */
  notices?: ReactNode;
  /** 输入卡片；空会话时它渲染在引导区里，这里留空只放条与盒子。 */
  children?: ReactNode;
}) {
  return (
    <div ref={dockRef} className={styles.dock}>
      {showScrollBottom && (
        <button
          type="button"
          className={styles.scrollBottomBtn}
          aria-label={isZh ? "回到底部" : "Scroll to bottom"}
          onClick={onScrollToLatest}
        >
          <IconArrowDown size={15} stroke={2} />
        </button>
      )}
      {notices}
      <SessionBars
        view={view}
        todos={todos}
        paused={paused}
        settled={settled}
        goal={goal}
        isZh={isZh}
        className={styles.stack}
        onEditGoal={onEditGoal}
        onToggleGoalAuto={onToggleGoalAuto}
      />
      {children}
    </div>
  );
}