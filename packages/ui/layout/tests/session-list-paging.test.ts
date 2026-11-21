// 验证会话列表分页：每批 6 条、逐批展开、全部展开后收起，以及项目行与「最近」分组的控件接线。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkbenchChatSessionSummary } from "../contract/index";
import type { LocalProject } from "../client/navigation";
import { locales } from "../client/locales";
import { buildRecentGroup } from "../client/components/navigation-groups-config";
import {
  createProjectWithChatItems,
  createSessionWindowItem,
  type ProjectItemDeps,
  type SessionItemDeps,
} from "../client/components/navigation-items";
import {
  SESSION_PAGE_SIZE,
  createSessionWindowControl,
  nextSessionWindow,
  resolveSessionWindow,
} from "../client/components/session-list-paging";

/** 构造一条仅覆盖侧栏行字段的会话摘要。 */
function session(index: number, projectId: string | null = "app1"): WorkbenchChatSessionSummary {
  return {
    id: `s${index}`,
    title: `会话 ${index}`,
    projectId,
    messageCount: 0,
    createdAt: index,
    updatedAt: index,
  };
}

/** 构造最小项目对象。 */
function project(id = "app1"): LocalProject {
  return { id, name: id, createdAt: 0 };
}

const baseDeps: ProjectItemDeps & SessionItemDeps = {
  activeProjectId: null,
  activeView: "workspace",
  activeChatSessionId: null,
  showActive: true,
  onRowActivate: () => {},
  isProjectExpanded: () => true,
  onNewChatInProject: () => {},
  onToggleProjectExpanded: () => {},
  onExpandProject: () => {},
  onToggleProjectPin: () => {},
  pinProjectLabel: "置顶项目",
  unpinProjectLabel: "取消置顶",
};

const labels = {
  expandLabel: (count: number) => `展开其余 ${count} 个会话`,
  collapseLabel: "收起会话",
};

test("会话窗口每批 6 条，越界收起并且下一批不超过剩余数", () => {
  assert.deepEqual(resolveSessionWindow(12, 6), {
    visible: 6,
    remaining: 6,
    nextBatch: 6,
    fullyExpanded: false,
  });
  assert.deepEqual(resolveSessionWindow(13, 12), {
    visible: 12,
    remaining: 1,
    nextBatch: 1,
    fullyExpanded: false,
  });
  assert.deepEqual(resolveSessionWindow(13, 13), {
    visible: 13,
    remaining: 0,
    nextBatch: 0,
    fullyExpanded: true,
  });
  // 会话被删除后，已展开数收敛到总量，不出现负数或空窗口。
  assert.deepEqual(resolveSessionWindow(4, 6), {
    visible: 4,
    remaining: 0,
    nextBatch: 0,
    fullyExpanded: true,
  });
  assert.equal(nextSessionWindow(20, 6), 12);
  assert.equal(nextSessionWindow(8, 6), 8);
  assert.equal(SESSION_PAGE_SIZE, 6);
});

test("不超过一批时不显示控件，全部展开后切换为收起", () => {
  let clicks = 0;
  assert.equal(createSessionWindowControl({
    total: 6,
    shown: 6,
    ...labels,
    onShowMore: () => {},
    onCollapse: () => {},
  }), null);

  const more = createSessionWindowControl({
    total: 12,
    shown: 6,
    ...labels,
    onShowMore: () => { clicks += 1; },
    onCollapse: () => { clicks -= 1; },
  });
  assert.equal(more?.label, "展开其余 6 个会话");
  assert.equal(more?.expanded, false);
  more?.onClick();
  assert.equal(clicks, 1);

  const collapse = createSessionWindowControl({
    total: 12,
    shown: 12,
    ...labels,
    onShowMore: () => { clicks += 1; },
    onCollapse: () => { clicks -= 1; },
  });
  assert.equal(collapse?.label, "收起会话");
  assert.equal(collapse?.expanded, true);
  collapse?.onClick();
  assert.equal(clicks, 0);
});

test("项目行只渲染一批子会话，并在末尾追加展开控件", () => {
  const sessions = Array.from({ length: 14 }, (_, index) => session(index));
  const items = createProjectWithChatItems([project()], "project", sessions, {
    ...baseDeps,
    sessionVisibleCount: (_rowId, total) => resolveSessionWindow(total, 6).visible,
    sessionListControl: (_rowId, total) => createSessionWindowControl({
      total,
      shown: 6,
      ...labels,
      onShowMore: () => {},
      onCollapse: () => {},
    }),
  });

  assert.equal(items.length, 1 + 6 + 1);
  assert.equal(items.filter((item) => item.control).length, 1);
  const control = items.at(-1);
  assert.equal(control?.label, "展开其余 6 个会话");
  assert.equal(control?.nested, true);
  assert.equal(control?.onClick instanceof Function, true);
  assert.equal(items[1]?.id, "project:app1:s0");
});

test("项目子会话全部展开后控件变为收起，点击执行收起", () => {
  const sessions = Array.from({ length: 8 }, (_, index) => session(index));
  let collapsed = false;
  const items = createProjectWithChatItems([project()], "project", sessions, {
    ...baseDeps,
    sessionVisibleCount: (_rowId, total) => resolveSessionWindow(total, 8).visible,
    sessionListControl: (_rowId, total) => createSessionWindowControl({
      total,
      shown: 8,
      ...labels,
      onShowMore: () => {},
      onCollapse: () => { collapsed = true; },
    }),
  });

  assert.equal(items.length, 1 + 8 + 1);
  assert.equal(items.at(-1)?.label, "收起会话");
  items.at(-1)?.onClick();
  assert.equal(collapsed, true);
});

test("收起控件行保持项目内缩进、隐藏图标并带展开状态", () => {
  const item = createSessionWindowItem("project:app1:session-window", {
    label: "展开其余 6 个会话",
    expanded: false,
    onClick: () => {},
  }, true);

  assert.equal(item.control, true);
  assert.equal(item.nested, true);
  assert.equal(item.hideIcon, true);
  assert.equal(item.expanded, false);
  assert.equal(item.icon, "chevronDown");
});

test("「最近」分组按窗口裁剪行，并在末尾追加控件", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    id: `r${index}`,
    label: `最近 ${index}`,
    icon: "newChat" as const,
    onClick: () => {},
  }));
  const control = createSessionWindowControl({
    total: items.length,
    shown: 6,
    expandLabel: locales.zh.expandSessions,
    collapseLabel: locales.zh.collapseSessions,
    onShowMore: () => {},
    onCollapse: () => {},
  });
  const group = buildRecentGroup({
    locale: locales.zh,
    items,
    expanded: true,
    onToggle: () => {},
    tools: null,
    visibleCount: 6,
    control,
  });

  assert.equal(group.items.length, 7);
  assert.equal(group.items[0]?.id, "r0");
  assert.equal(group.items.at(-1)?.label, "展开其余 2 个会话");
  assert.equal(group.items.at(-1)?.control, true);
  assert.equal(group.emptyText, locales.zh.noRecentItems);
});