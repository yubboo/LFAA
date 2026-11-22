// 输入栏底部统计条：上下文用量与本轮文件变更入口，独立于输入框主体。
import type { ChatMessageItem } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import { SessionStatsBar } from "../session/SessionStatsBar";
import styles from "../conversation/ChatWorkspace.module.css";

export function ComposerStats({ locale, messages, lastMessageId, stats, showContext, onOpenTurnChanges }: {
  locale: ChatLocaleMessages;
  messages: ChatMessageItem[];
  lastMessageId: string | undefined;
  stats: { filesCount: number; countedChanges: boolean; added: number; removed: number };
  showContext: boolean;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
}) {
  return (
    <SessionStatsBar
      messages={messages}
      locale={locale}
      showContext={showContext}
      leading={lastMessageId && stats.filesCount > 0 && onOpenTurnChanges ? (
        <button type="button" className={styles.turnChangesTrigger}
          title={locale.isZh ? "查看本轮变更。增删为已记录操作的行数" : "Review changes this turn. Line counts are per recorded edit."}
          onClick={() => { if (lastMessageId) onOpenTurnChanges(lastMessageId); }}>
          {locale.isZh ? `${stats.filesCount} 个文件已变更` : `${stats.filesCount} files changed`}
          {stats.countedChanges && <><span data-change="add">+{stats.added}</span><span data-change="remove">−{stats.removed}</span></>}
        </button>
      ) : undefined}
    />
  );
}