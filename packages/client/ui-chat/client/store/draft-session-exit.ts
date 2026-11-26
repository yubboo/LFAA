// 新会话草稿退场：先给侧栏行打上 draftExiting，让 CSS 收起高度，再由定时器从快照移除。
import type { ChatSessionItem } from "./chat-types";
import type { ChatStorePort } from "./chat-store-port";

/** 比侧栏 200ms 退场过渡多留一段余量，渲染稍慢时也先收完高度再移除。 */
export const DRAFT_EXIT_MS = 320;

let exitTimer: ReturnType<typeof setTimeout> | null = null;

/** 标记当前草稿为退场行并安排移除；返回要写入快照的退场行。 */
export function beginDraftExit(
  port: ChatStorePort,
  draft: ChatSessionItem | null | undefined,
): ChatSessionItem | null {
  if (!draft) return null;
  cancelDraftExitTimer();
  const exiting = { ...draft, draftExiting: true };
  const handle = setTimeout(() => {
    exitTimer = null;
    if (port.getState().exitingDraftSession?.id === exiting.id) {
      port.patchState({ exitingDraftSession: null });
    }
  }, DRAFT_EXIT_MS) as ReturnType<typeof setTimeout> & { unref?: () => void };
  // Node 测试环境不因一个 220ms 的动画计时器拖住进程；浏览器没有 unref，自动跳过。
  handle.unref?.();
  exitTimer = handle;
  return exiting;
}

/** 新草稿出现时取消上一行的退场计时；调用方同时把 exitingDraftSession 清空。 */
export function cancelDraftExitTimer(): void {
  if (!exitTimer) return;
  clearTimeout(exitTimer);
  exitTimer = null;
}