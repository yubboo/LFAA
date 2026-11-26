// 中间对话会话区盒子：整个工作区唯一的滚动视口，底部渐隐画在视口内部，只淡出正文，不外溢到输入区。
import type { ReactNode, RefObject, UIEvent, WheelEvent } from "react";
import styles from "./ChatFlowArea.module.css";

/**
 * 渲染会话区。滚动所有权仍归 useChatScroll：这里只把同一个元素和它的两个事件交下去，
 * 不在盒子内部改写 scrollTop，避免和贴底跟随抢所有权。
 */
export function ChatFlowArea({
  scrollAreaRef,
  hidden,
  onScroll,
  onWheel,
  fade = true,
  children,
}: {
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
  /** 有消息时才需要底部渐隐；空会话引导区保持完整可见。 */
  fade?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      ref={scrollAreaRef}
      className={styles.scroller}
      hidden={hidden}
      onScroll={onScroll}
      onWheel={onWheel}
    >
      {children}
      {/* 渐隐贴在视口底部而非输入区上：它是这个盒子的一部分，滚动条、命中都不受影响。 */}
      {fade && <div className={styles.fade} aria-hidden="true" />}
    </div>
  );
}