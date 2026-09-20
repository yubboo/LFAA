/** Chat Timeline / Work Canvas 内容模块。输入框和 Runtime Control 不属于这里。 */
import type { AgentSurfaceMode } from "@lfaa/agent-runtime";
import { InfiniteCanvas, type InfiniteCanvasEdge, type InfiniteCanvasNode } from "@lfaa/ui";
import type { ChatProjectionMessage, LayoutMode } from "../center-dependencies";
import styles from "./Conversation.module.css";

const INITIAL_WORK_EDGES: readonly InfiniteCanvasEdge[] = [
  { id:"goal-agent", from:"goal", to:"agent" }, { id:"agent-tools", from:"agent", to:"tools" }, { id:"agent-subagent", from:"agent", to:"subagent" }, { id:"tools-result", from:"tools", to:"result" }, { id:"subagent-result", from:"subagent", to:"result" },
];

export function ConversationRegion({ agentSurface, layoutMode, chatMessages, workNodes, onWorkNodesChange }: {
  agentSurface:AgentSurfaceMode; layoutMode:LayoutMode; chatMessages:readonly ChatProjectionMessage[]; workNodes:readonly InfiniteCanvasNode[]; onWorkNodesChange:(nodes:readonly InfiniteCanvasNode[])=>void;
}) {
  if(agentSurface==="chat") return <div className={styles.scroll} data-layout-mode={layoutMode} data-ui="conversation"><div className={styles.inner}>
    {chatMessages.length===0?<article className={`${styles.answer} ${styles.welcome}`}><h1>聊天</h1><p>直接说你想完成什么。当前开发态已经接通真实模型对话；Tools / Skills / MCP 会在 P2 Invocation 接入同一条 Run。</p></article>:
    <div className={styles.timeline} role="log" aria-live="polite">{chatMessages.map((message)=>{
      const roleClass=message.role==="user"?styles.user:message.role==="assistant"?styles.assistant:styles.error;
      return <article key={message.id} className={`${styles.message} ${roleClass}`}><div className={styles.role}>{message.role==="user"?"你":message.role==="assistant"?"LFAA":"运行错误"}</div><div className={styles.body}>{message.text}</div></article>;
    })}</div>}
  </div></div>;
  return <div className={styles.workSurface} data-ui="work-canvas"><div className={styles.workTitle}><strong>工作</strong><span>无限画布</span></div><InfiniteCanvas nodes={workNodes} edges={INITIAL_WORK_EDGES} onNodesChange={onWorkNodesChange}/></div>;
}
