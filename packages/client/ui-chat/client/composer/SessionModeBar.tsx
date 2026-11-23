// 顶栏标题右侧的会话模式徽标：订阅聊天快照，替代原先挤在输入栏工具栏里的模式选择。
import { useState, useSyncExternalStore } from "react";
import type { ChatClientStore } from "../store/chat-store";
import { SessionMode } from "./Session-Mode";
import styles from "./SessionModeBar.module.css";

/**
 * 渲染当前会话（或草稿）的模式选择：有消息或正在运行时只展示锁定状态。
 * @param store - 聊天客户端 store，同时提供快照订阅与模式切换动作。
 * @param isZh - 当前界面语言。
 */
export function SessionModeBar({ store, isZh }: { store: ChatClientStore; isZh: boolean }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [error, setError] = useState<string | null>(null);
  const session = state.activeSession;
  const messagesCount = session?.messages.length ?? 0;
  return (
    <span className={styles.root} data-failed={error !== null ? "" : undefined} title={error ?? undefined}>
      <SessionMode
        isZh={isZh}
        selected={session ? session.sessionPreset : state.draftSessionPreset}
        locked={messagesCount > 0 || Boolean(state.runningRunId)}
        busy={Boolean(state.submittingMessage)}
        onSelect={(id) => {
          setError(null);
          void store.selectSessionPreset(id).catch((cause: unknown) => {
            // 顶栏没有输入栏的提示位，失败保留原模式并把原因挂到徽标的 title 上。
            setError(cause instanceof Error ? cause.message : String(cause));
          });
        }}
      />
    </span>
  );
}