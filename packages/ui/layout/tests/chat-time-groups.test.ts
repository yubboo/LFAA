// 验证聊天模式的时间分桶：今天 / 昨天 / 最近 7 天内，7 天外不进列表；分组顺序与空组隐藏。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkbenchChatSessionSummary } from "../contract/index";
import { bucketChatSessions, chatTimeBucket, isWithinChatWindow } from "../client/navigation/chat-time-buckets";
import { buildChatTimeGroups } from "../client/navigation/chat-time-groups";
import { locales } from "../client/locales";
import { readChatGroupExpandedPref, writeChatGroupExpandedPref } from "../client/shell/ui-preferences";

/** 固定“现在”为本地 2026-11-26 12:00，避免跨时区随机。 */
const NOW = new Date(2026, 10, 26, 12, 0, 0).getTime();
const atDay = (daysAgo: number, hour = 10): number => new Date(2026, 10, 26 - daysAgo, hour).getTime();

test("时间分桶：今天 / 昨天 / 最近 7 天内 / 7 天外隐藏", () => {
  assert.equal(chatTimeBucket(atDay(0), NOW), "today");
  assert.equal(chatTimeBucket(atDay(0, 0), NOW), "today");
  assert.equal(chatTimeBucket(atDay(1, 23), NOW), "yesterday");
  assert.equal(chatTimeBucket(atDay(2), NOW), "last7");
  assert.equal(chatTimeBucket(atDay(6, 0), NOW), "last7");
  assert.equal(chatTimeBucket(atDay(7), NOW), null);
  assert.equal(isWithinChatWindow(atDay(6), NOW), true);
  assert.equal(isWithinChatWindow(atDay(7), NOW), false);
});

test("时间分桶：未来或非法时间按今天处理", () => {
  assert.equal(chatTimeBucket(atDay(-2), NOW), "today");
  assert.equal(chatTimeBucket(Number.NaN, NOW), "today");
});

test("分桶结果按更新时间倒序，7 天外单独留在 hidden", () => {
  const sessions = [
    { id: "old", updatedAt: atDay(8) },
    { id: "today-early", updatedAt: atDay(0, 8) },
    { id: "today-late", updatedAt: atDay(0, 11) },
    { id: "yesterday", updatedAt: atDay(1) },
    { id: "last7", updatedAt: atDay(3) },
  ];
  const buckets = bucketChatSessions(sessions, NOW);
  assert.deepEqual(buckets.today.map((item) => item.id), ["today-late", "today-early"]);
  assert.deepEqual(buckets.yesterday.map((item) => item.id), ["yesterday"]);
  assert.deepEqual(buckets.last7.map((item) => item.id), ["last7"]);
  assert.deepEqual(buckets.hidden.map((item) => item.id), ["old"]);
});

test("聊天模式分组：今天 / 昨天 / 最近 7 天，空组不渲染，归档与 7 天外不出现", () => {
  const session = (id: string, daysAgo: number, extra: Partial<WorkbenchChatSessionSummary> = {}): WorkbenchChatSessionSummary => ({
    id,
    title: id,
    projectId: null,
    messageCount: 1,
    createdAt: atDay(daysAgo),
    updatedAt: atDay(daysAgo),
    ...extra,
  });
  const sessions = [
    session("today-a", 0),
    session("yesterday-a", 1),
    session("recent-a", 4),
    session("old-a", 9),
    session("archived-a", 0, { archived: true }),
  ];
  const groups = buildChatTimeGroups({
    sessions,
    locale: locales.zh,
    now: NOW,
    deps: {
      projects: [],
      chatSessions: sessions,
      activeView: "workspace",
      activeProjectId: null,
      activeChatSessionId: null,
      onOpenProject: () => {},
      onNavigate: () => {},
    },
  });

  assert.deepEqual(groups.map((group) => group.id), ["chat-today", "chat-yesterday", "chat-last7"]);
  assert.deepEqual(groups.map((group) => group.title), ["今天", "昨天", "最近（7 天内）"]);
  assert.deepEqual(groups.map((group) => group.collapsible), [true, true, true]);
  assert.deepEqual(groups.map((group) => group.expanded), [true, true, true]);
  assert.deepEqual(groups[0]?.items.map((item) => item.label), ["today-a"]);
  assert.deepEqual(groups[1]?.items.map((item) => item.label), ["yesterday-a"]);
  assert.deepEqual(groups[2]?.items.map((item) => item.label), ["recent-a"]);
  assert.equal(groups.some((group) => group.items.some((item) => item.label === "old-a")), false);
  assert.equal(groups.some((group) => group.items.some((item) => item.label === "archived-a")), false);
});

test("聊天模式分组：折叠状态由调用方控制，点击标题回调对应分组", () => {
  const session = (id: string, hoursAgo: number): WorkbenchChatSessionSummary => ({
    id,
    title: id,
    projectId: null,
    messageCount: 1,
    createdAt: NOW - hoursAgo * 3_600_000,
    updatedAt: NOW - hoursAgo * 3_600_000,
  });
  const sessions = [session("today", 1), session("yesterday", 26)];
  const toggled: string[] = [];
  const groups = buildChatTimeGroups({
    sessions,
    locale: locales.zh,
    now: NOW,
    expanded: (groupId) => groupId !== "chat-yesterday",
    onToggle: (groupId) => toggled.push(groupId),
    deps: {
      projects: [],
      chatSessions: sessions,
      activeView: "workspace",
      activeProjectId: null,
      activeChatSessionId: null,
      onOpenProject: () => {},
      onNavigate: () => {},
    },
  });
  assert.equal(groups[0]?.expanded, true);
  assert.equal(groups[1]?.expanded, false);
  groups[1]?.onToggle?.();
  assert.deepEqual(toggled, ["chat-yesterday"]);
});

test("聊天分组折叠状态写入浏览器记忆，刷新后仍能读回", () => {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  };
  try {
    assert.deepEqual(readChatGroupExpandedPref(), {});
    writeChatGroupExpandedPref({ today: false, last7: true });
    assert.deepEqual(readChatGroupExpandedPref(), { today: false, last7: true });
    store.set("lfaa:chat-group-expanded", "{broken");
    assert.deepEqual(readChatGroupExpandedPref(), {});
  } finally {
    if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window: unknown }).window = prevWindow;
  }
});

test("聊天模式分组：没有可见会话时不渲染任何分组", () => {
  const groups = buildChatTimeGroups({
    sessions: [{
      id: "old",
      title: "old",
      projectId: null,
      messageCount: 1,
      createdAt: atDay(10),
      updatedAt: atDay(10),
    }],
    locale: locales.zh,
    now: NOW,
    deps: {
      projects: [],
      chatSessions: [],
      activeView: "workspace",
      activeProjectId: null,
      activeChatSessionId: null,
      onOpenProject: () => {},
      onNavigate: () => {},
    },
  });
  assert.deepEqual(groups, []);
});