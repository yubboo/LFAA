/**
 * 文件：ChatWorkspace.tsx
 * 作用：Workspace / Chat 模式的线性消息投影。
 * 负责：欢迎态、用户/AI/Error 消息时间线与 Composer 水平基线一致性。
 * 不负责：Agent Run、Composer、模型、权限、Work Canvas。
 * 状态归属：无业务状态；只消费 Workspace Session 提供的 ChatProjectionMessage。
 * 对外接口：ChatWorkspace({ layoutMode, messages })。
 * 关联文件：../styles/ChatWorkspace.module.css、../../shared/contracts/workspace.types.ts。
 * 修改注意事项：用户消息保持右对齐，AI/Error 保持左对齐；不要读取 Composer 私有状态。
 */
import type { ChatProjectionMessage } from "#workspace/contracts";
import styles from "../styles/ChatWorkspace.module.css";

export function ChatWorkspace({ layoutMode, messages }: {
  layoutMode: "desktop" | "compact" | "mobile";
  messages: readonly ChatProjectionMessage[];
}) {
  return (
    <div className={styles.scroll} data-layout-mode={layoutMode} data-ui="chat-workspace">
      <div className={styles.inner}>
        {messages.length === 0 ? (
          <article className={`${styles.answer} ${styles.welcome}`}>
            <h1>聊天</h1>
            <p>直接说你想完成什么。当前开发态已经接通真实模型对话；Tools / Skills / MCP 会在 P2 Invocation 接入同一条 Run。</p>
          </article>
        ) : (
          <div className={styles.timeline} role="log" aria-live="polite">
            {messages.map((message) => {
              const roleClass = message.role === "user" ? styles.user : message.role === "assistant" ? styles.assistant : styles.error;
              return (
                <article key={message.id} className={`${styles.message} ${roleClass}`}>
                  <div className={styles.role}>{message.role === "user" ? "你" : message.role === "assistant" ? "LFAA" : "运行错误"}</div>
                  <div className={styles.body}>{message.text}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
