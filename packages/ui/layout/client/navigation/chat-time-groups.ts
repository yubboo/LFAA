// 聊天模式左二栏：把会话按「今天 / 昨天 / 最近（7 天内）」分组，复用工作模式的会话行与分组外观。
// 聊天模式同时列出属于项目的会话（方便查看），行点击仍是打开该会话；7 天外的会话不进列表。
import type { WorkbenchChatSessionSummary } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { SidebarGroupConfig } from "../panels/SidebarSectionList";
import { bucketChatSessions } from "./chat-time-buckets";
import { createRecentSidebarItems, type RecentItemDeps } from "./navigation-items";

/** 生成聊天模式的时间分组；空分组不渲染，组内按最后更新时间倒序，分组可折叠（与工作模式同款）。 */
export function buildChatTimeGroups({
  sessions,
  locale,
  deps,
  onSelectSession,
  expanded,
  onToggle,
  now = Date.now(),
}: {
  sessions: WorkbenchChatSessionSummary[];
  locale: LocaleMessages;
  deps: RecentItemDeps;
  onSelectSession?: ((sessionId: string) => void) | undefined;
  /** 分组是否展开；缺省视为展开。 */
  expanded?: ((groupId: string) => boolean) | undefined;
  onToggle?: ((groupId: string) => void) | undefined;
  now?: number;
}): SidebarGroupConfig[] {
  const buckets = bucketChatSessions(sessions.filter((session) => !session.archived), now);
  const sections = [
    { id: "chat-today", title: locale.chatGroupToday, items: buckets.today },
    { id: "chat-yesterday", title: locale.chatGroupYesterday, items: buckets.yesterday },
    { id: "chat-last7", title: locale.chatGroupLast7, items: buckets.last7 },
  ];
  return sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({
      id: section.id,
      title: section.title,
      collapsible: true,
      expanded: expanded?.(section.id) ?? true,
      ...(onToggle ? { onToggle: () => onToggle(section.id) } : {}),
      items: createRecentSidebarItems(
        section.items.map((session) => ({
          id: session.id,
          sessionId: session.id,
          label: session.title,
          view: "workspace" as const,
          ...(session.projectId ? { projectId: session.projectId } : {}),
          ...(session.unread ? { unread: true } : {}),
          updatedAt: session.updatedAt,
          active: session.id === deps.activeChatSessionId,
          onSelect: () => {
            deps.chatProvider?.closeSessionMenus?.();
            onSelectSession?.(session.id);
            void deps.chatProvider?.openSession(session.id);
          },
        })),
        deps,
      ),
    }));
}