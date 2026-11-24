// 顶栏标题右侧的会话模式徽标：精确切片订阅聊天快照，避免流式正文输出期间随每帧重绘。
import { useState } from "react";
import type { ChatClientStore } from "../store/chat-store";
import { useChatSelector } from "../store/use-chat-selector";
import { SessionMode } from "./Session-Mode";
import styles from "./SessionModeBar.module.css";

/**
 * 会话进行中把模式徽标放回顶栏标题右侧；空会话仍由输入栏承担，避免标题栏出现空占位。
 * @param store - 聊天客户端 store，用于判断当前是否已进入某个会话。
 * @param isZh - 当前界面语言。
 */
export function SessionModeTitleAction({ store, isZh }: { store: ChatClientStore; isZh: boolean }) {
  const hasMessages = useChatSelector(store, (s) => (s.activeSession?.messages.length ?? 0) > 0);
  if (!hasMessages) return null;
  return <SessionModeBar store={store} isZh={isZh} />;
}

/**
 * 渲染当前会话（或草稿）的模式选择：有消息或正在运行时只展示锁定状态。
 * @param store - 聊天客户端 store，同时提供快照订阅与模式切换动作。
 * @param isZh - 当前界面语言。
 */
export function SessionModeBar({ store, isZh, compact = false }: { store: ChatClientStore; isZh: boolean; compact?: boolean }) {
  const slice = useChatSelector(store, (s) => ({
    selected: s.activeSession ? s.activeSession.sessionPreset : s.draftSessionPreset,
    locked: (s.activeSession?.messages.length ?? 0) > 0 || Boolean(s.runningRunId),
    busy: Boolean(s.submittingMessage),
  }));
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={styles.root} data-failed={error !== null ? "" : undefined} data-compact={compact ? "" : undefined} title={error ?? undefined}>
      <SessionMode
        isZh={isZh}
        selected={slice.selected}
        locked={slice.locked}
        busy={slice.busy}
        compact={compact}
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