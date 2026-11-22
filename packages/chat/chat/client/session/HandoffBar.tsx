// 输入区上方的交接条：展示一条待接手任务的标题、摘要与来源，提供接手/忽略。
import { IconArrowsExchange } from "@tabler/icons-react";
import type { ChatHandoffItem } from "../store/chat-types";
import styles from "./HandoffBar.module.css";

/** 交接条只展示摘要；接手由父组件调用 Host 创建目标并刷新目标条。 */
export function HandoffBar({ handoff, isZh, onAccept, onDismiss }: {
  handoff: ChatHandoffItem;
  isZh: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className={styles.root} data-testid="handoff-bar" aria-label={isZh ? "待接手的交接" : "Pending handoff"} title={handoff.summary}>
      <IconArrowsExchange size={15} className={styles.lead} aria-hidden="true" />
      <span className={styles.label}>{isZh ? "待接手" : "Handoff"}</span>
      <span className={styles.title}>{handoff.title}</span>
      <span className={styles.summary}>{handoff.summary}</span>
      <button type="button" className={styles.primary} onClick={onAccept}>
        {isZh ? "接手" : "Accept"}
      </button>
      <button type="button" className={styles.ghost} onClick={onDismiss}>
        {isZh ? "忽略" : "Dismiss"}
      </button>
    </section>
  );
}