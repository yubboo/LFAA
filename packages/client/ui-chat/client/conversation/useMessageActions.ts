// 消息区交互接线：编辑内容、分叉到新会话、继续中断消息、提问、审批，以及媒体引用的再生成。
// 从 ChatWorkspace 拆出：这些回调只依赖 store、composer 与当前会话，和布局无关。
import type { ChatLocaleMessages } from "../locales";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatMessageItem, ChatSessionDetail } from "../store/chat-types";
import type { useChatComposer } from "../composer/useChatComposer";
import type { MediaResultContextValue } from "@lfaa/client-ui-tool-media/client";

/** 消息区动作所需依赖。 */
export interface MessageActionsDeps {
  store: ChatClientStore;
  composer: ReturnType<typeof useChatComposer>;
  locale: ChatLocaleMessages;
  activeSession: ChatSessionDetail | null | undefined;
  activeProjectId: string | null | undefined;
  /** 运行中 / 提交中 / 绑定项目中：媒体动作统一置灰。 */
  busy: boolean;
}

/** 返回可直接展开给 ChatMessageList 的动作集合。 */
export function useMessageActions({ store, composer, locale, activeSession, activeProjectId, busy }: MessageActionsDeps) {
  /** 把消息正文回填到输入框并聚焦，用于「编辑后重发」。 */
  const onEditContent = (content: string) => {
    composer.setDraft(content);
    composer.textareaRef.current?.focus();
  };

  /** 以当前消息为上下文开新会话，正文截断后作为引用前缀。 */
  const onBranchToNewChat = (message: ChatMessageItem) => {
    store.startNewChatDraft({
      projectId: activeProjectId ?? null,
      sectionId: activeSession?.sectionId ?? null,
    });
    composer.setDraft(
      locale.isZh
        ? `基于以下前文继续探讨：\n> ${message.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`
        : `Continue from:\n> ${message.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`,
    );
    composer.textareaRef.current?.focus();
  };

  const mediaActions: Pick<MediaResultContextValue, "busy" | "onQuote" | "onRegenerate"> = {
    busy,
    onQuote: (source, url, label) => {
      if (!activeSession) return;
      composer.appendAttachments([{
        id: `media-${source.messageId}-${source.path}`, kind: "file" as const, label,
        path: source.path, mediaSource: { ...source, sessionId: activeSession.id, url },
      }]);
      composer.focusTextareaAt(composer.draft.length);
    },
    onRegenerate: (source, ratio) => {
      // 生成中的进度由消息区占位呈现；这里只在失败时提示，不再占用输入框上方状态条。
      void store.generateMediaFromPrompt({ regenerate: source, ...(ratio ? { ratio } : {}) }).then((result) => {
        if (!result.ok) composer.setContextNotice(result.error ?? (locale.isZh ? "再次生图失败" : "Regenerate failed"));
      });
    },
  };

  return {
    onEditContent,
    onBranchToNewChat,
    mediaActions,
    onContinueInterrupted: (messageId: string) => void store.continueInterruptedMessage(messageId),
    onSubmitQuestion: (question: string) => void composer.handleSubmit(question),
    onResolveApproval: (approved: boolean) => void store.resolveApproval(approved),
  };
}