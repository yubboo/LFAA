/**
 * 文件：components/ConversationAnchorRail.tsx
 * 功能：呈现当前会话的提问锚点和悬停预览。
 * 作用：将指针位置映射到最近锚点并派发跳转回调；布局数值与消息滚动仍由包级纯逻辑模块提供。
 * 不负责：读取会话、加载消息或保存滚动状态。
 * 关联文件：AiWorkChat.tsx、conversation-anchor-preview.ts、conversation-scroll.ts、ai-work-chat.css。
 */
import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { ConversationAnchorPreview } from "./conversation-anchor-preview.js";
import { conversationAnchorLabel, conversationAnchorReply } from "./conversation-anchor-preview.js";
import { buildConversationAnchorLayout, createFrameCoalescer, findNearestConversationAnchorIndex, updateConversationAnchorPointerTarget } from "./conversation-scroll.js";
function conversationAnchorPreviewOwner(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const owner = target.closest(".ai-work-chat__anchor-preview")?.closest(".ai-work-chat__anchor");
  return owner instanceof HTMLElement ? owner : null;
}

interface ConversationAnchorRailProps {
  anchors: ConversationAnchorPreview[];
  layout: ReturnType<typeof buildConversationAnchorLayout>;
  activeAnchorId: string | null;
  onJump: (messageId: string) => void;
}

export const ConversationAnchorRail = memo(function ConversationAnchorRail({ anchors, layout, activeAnchorId, onJump }: ConversationAnchorRailProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const anchorListRef = useRef<HTMLDivElement | null>(null);
  const pointerActiveElementRef = useRef<HTMLElement | null>(null);
  const latestSelectionDataRef = useRef({ anchors, positions: layout.positions });
  latestSelectionDataRef.current = { anchors, positions: layout.positions };
  const pointerFrameRef = useRef<ReturnType<typeof createFrameCoalescer<number>> | null>(null);
  if (pointerFrameRef.current === null) {
    pointerFrameRef.current = createFrameCoalescer<number>((clientY) => {
      const nav = navRef.current;
      if (!nav) return;
      const { anchors: currentAnchors, positions } = latestSelectionDataRef.current;
      const localY = clientY - nav.getBoundingClientRect().top;
      const index = findNearestConversationAnchorIndex(positions, localY);
      const list = anchorListRef.current;
      const nextElement = index === null || !currentAnchors[index] ? null : list?.children.item(index) as HTMLElement | null ?? null;
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, nextElement);
    });
  }

  useEffect(() => () => {
    pointerFrameRef.current?.cancel();
    pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, null);
  }, []);

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (event.pointerType === "touch") return;
    const previewOwner = conversationAnchorPreviewOwner(event.target);
    if (previewOwner) {
      pointerFrameRef.current?.cancel();
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, previewOwner);
      return;
    }

    pointerFrameRef.current?.schedule(event.clientY);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLElement>): void {
    const previewOwner = conversationAnchorPreviewOwner(event.relatedTarget);
    if (previewOwner) {
      pointerFrameRef.current?.cancel();
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, previewOwner);
      return;
    }
    pointerFrameRef.current?.cancel();
    pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, null);
  }

  return <nav
    ref={navRef}
    className="ai-work-chat__anchors"
    aria-label="本会话对话锚点"
    style={{ height: `${layout.height}px` }}
    data-mark-height={layout.markHeight}
    onPointerMove={handlePointerMove}
    onPointerLeave={handlePointerLeave}
  >
    <div ref={anchorListRef} className="ai-work-chat__anchor-list">
      {anchors.map(({ question, reply }, index) => {
        const label = conversationAnchorLabel(question.content) || "（无内容）";
        const replyPreview = conversationAnchorReply(reply);
        const replyLabel = conversationAnchorLabel(replyPreview) || replyPreview;
        const isActive = question.id === activeAnchorId;
        return <button
          type="button"
          className={`ai-work-chat__anchor${isActive ? " is-active" : ""}`}
          key={question.id}
          style={{ top: `${(layout.positions[index] ?? 0) - Math.floor(layout.hitAreaHeight / 2)}px`, height: `${layout.hitAreaHeight}px` }}
          aria-current={isActive ? "location" : undefined}
          aria-label={`跳转到第 ${index + 1} 条提问：${label}；助手回复：${replyLabel}`}
          onClick={(event) => {
            // 指针点击后释放按钮焦点，避免残留的可见焦点覆盖回复区失焦；键盘激活仍保留焦点。
            if (event.detail > 0) event.currentTarget.blur();
            onJump(question.id);
          }}
        >
          <span className="ai-work-chat__anchor-mark" style={{ top: `${layout.markOffset}px` }} aria-hidden="true" />
          <span className="ai-work-chat__anchor-preview" style={{ top: `${Math.floor(layout.hitAreaHeight / 2)}px` }} aria-hidden="true"><strong>{question.content.trim() || "（无内容）"}</strong><span>{replyPreview}</span></span>
        </button>;
      })}
    </div>
  </nav>;
});

