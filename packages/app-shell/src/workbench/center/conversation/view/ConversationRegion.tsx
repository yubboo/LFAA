/**
 * 文件：ConversationRegion.tsx
 * 作用：中央内容区域；在 Chat Timeline 与 Work Canvas 两种 Surface 间切换。
 * 负责：Chat 消息投影、选择 WorkCanvasRegion 子模块。
 * 不负责：Work Canvas 布局状态、Composer、Runtime Control、Agent Run 生命周期。
 */
import type { AgentSurfaceMode } from "@lfaa/agent-runtime";
import type { ChatProjectionMessage, LayoutMode } from "#center/contracts";
import { WorkCanvasRegion } from "../work-canvas";
import styles from "../styles/Conversation.module.css";

export function ConversationRegion({ agentSurface, layoutMode, chatMessages, workspaceId, lastRunInput }: {
  agentSurface: AgentSurfaceMode;
  layoutMode: LayoutMode;
  chatMessages: readonly ChatProjectionMessage[];
  workspaceId?: string;
  lastRunInput: string | null;
}) {
  if (agentSurface === "work") {
    return <WorkCanvasRegion workspaceId={workspaceId} lastRunInput={lastRunInput} />;
  }

  return (
    <div className={styles.scroll} data-layout-mode={layoutMode} data-ui="conversation">
      <div className={styles.inner}>
        {chatMessages.length === 0 ? (
          <article className={`${styles.answer} ${styles.welcome}`}>
            <h1>聊天</h1>
            <p>直接说你想完成什么。当前开发态已经接通真实模型对话；Tools / Skills / MCP 会在 P2 Invocation 接入同一条 Run。</p>
          </article>
        ) : (
          <div className={styles.timeline} role="log" aria-live="polite">
            {chatMessages.map((message) => {
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
