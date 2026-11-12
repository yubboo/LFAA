/**
 * 文件：reply-suggestions.ts
 * 功能：管理回复建议的单次提交和聊天历史中的已消费状态。
 * 作用：选中时立即从对应回复移除建议，重载历史时按之后发送的同文用户消息继续隐藏。
 * 不负责：模型生成、建议持久化、会话发送或权限判断；这些仍由 Agent Loop、Session 和 AiWorkChat Owner 负责。
 */

export interface ReplySuggestionMessage {
  id: string;
  role: string;
  content: string;
  promptSuggestions?: readonly string[];
}

export function consumeReplySuggestion<T extends ReplySuggestionMessage>(messages: readonly T[], messageId: string, suggestion: string): T[] {
  const normalizedSuggestion = suggestion.trim();
  if (!normalizedSuggestion) return messages as T[];

  return messages.map(message => {
    if (message.id !== messageId || message.role !== "assistant" || !message.promptSuggestions?.some(item => item.trim() === normalizedSuggestion)) return message;
    return {
      ...message,
      promptSuggestions: message.promptSuggestions.filter(item => item.trim() !== normalizedSuggestion)
    } as T;
  });
}

export function hideSubmittedReplySuggestions<T extends ReplySuggestionMessage>(messages: readonly T[]): T[] {
  const latestUserMessageIndex = new Map<string, number>();
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "user" && message.content.trim()) latestUserMessageIndex.set(message.content.trim(), index);
  }

  return messages.map((message, index) => {
    if (message.role !== "assistant" || !message.promptSuggestions?.length) return message;
    const suggestions = message.promptSuggestions.filter(suggestion => {
      const submittedAt = latestUserMessageIndex.get(suggestion.trim());
      return submittedAt === undefined || submittedAt <= index;
    });
    return suggestions.length === message.promptSuggestions.length ? message : { ...message, promptSuggestions: suggestions } as T;
  });
}

export interface ReplySuggestionSubmission {
  suggestion: string;
  canSubmit: () => boolean;
  consume: () => void;
  send: (suggestion: string) => void | Promise<unknown>;
}

export class ReplySuggestionSubmissionGate {
  private inFlight = false;

  submit(input: ReplySuggestionSubmission): boolean {
    if (this.inFlight || !input.canSubmit()) return false;
    this.inFlight = true;

    const release = (): void => { this.inFlight = false; };
    try {
      input.consume();
      void Promise.resolve(input.send(input.suggestion)).then(release, release);
      return true;
    } catch (error) {
      release();
      throw error;
    }
  }
}
