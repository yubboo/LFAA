// 验证左二导航的项目分组语义：置顶只在顶部增加快捷入口，项目本身仍留在「项目」或所属自定义分区里。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkbenchChatSessionSummary } from "../contract/index";
import type { LocalProject } from "../client/navigation/navigation";
import {
  createProjectSidebarItem,
  groupNavigationProjects,
  resolveActiveGroupKey,
  resolveNewChatProject,
  sectionGroupKey,
  selectPinnedSessions,
} from "../client/navigation/navigation-items";

/** 构造最小项目对象，仅覆盖分组用到的字段。 */
function project(id: string, extra: { pinned?: boolean; sectionId?: string } = {}): LocalProject {
  return { id, name: id, createdAt: 0, ...extra };
}

const projectDeps = {
  activeProjectId: null,
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

test("置顶项目同时出现在置顶快捷区与原来的项目分组", () => {
  const pinned = project("pinned-app", { pinned: true });
  const plain = project("plain-app");
  const sectioned = project("sectioned-app", { pinned: true, sectionId: "sec-1" });
  const groups = groupNavigationProjects([pinned, plain, sectioned], new Set(["sec-1"]));

  assert.deepEqual(groups.pinned.map((item) => item.id), ["pinned-app", "sectioned-app"]);
  assert.deepEqual(groups.unassigned.map((item) => item.id), ["pinned-app", "plain-app"]);
  assert.deepEqual(groups.inSection("sec-1").map((item) => item.id), ["sectioned-app"]);
});

test("置顶项目不会因为置顶被移出自定义分区", () => {
  const sectioned = project("sectioned-app", { pinned: true, sectionId: "sec-1" });
  const groups = groupNavigationProjects([sectioned], new Set(["sec-1"]));

  assert.equal(groups.unassigned.length, 0);
  assert.deepEqual(groups.inSection("sec-1").map((item) => item.id), ["sectioned-app"]);
});

test("项目行始终带图钉按钮，文案随置顶状态切换", () => {
  const pinned = project("pinned-app", { pinned: true });
  const plain = project("plain-app");
  const pinnedItem = createProjectSidebarItem(pinned, "project", projectDeps);
  const plainItem = createProjectSidebarItem(plain, "project", projectDeps);

  assert.equal(pinnedItem.pinned, true);
  assert.equal(pinnedItem.pinLabel, "取消置顶");
  assert.equal(plainItem.pinned, false);
  assert.equal(plainItem.pinLabel, "置顶项目");
  assert.equal(typeof pinnedItem.onTogglePin, "function");
  assert.equal(typeof plainItem.onTogglePin, "function");
});

test("点行内图钉只切换对应项目的置顶", () => {
  const plain = project("plain-app");
  const toggled: string[] = [];
  const item = createProjectSidebarItem(plain, "project", {
    ...projectDeps,
    onToggleProjectPin: (projectId) => toggled.push(projectId),
  });

  item.onTogglePin?.();

  assert.deepEqual(toggled, ["plain-app"]);
});

test("置顶分组只单独列出未被置顶项目带出的已置顶会话", () => {
  const session = (
    id: string,
    extra: Partial<WorkbenchChatSessionSummary> = {},
  ): WorkbenchChatSessionSummary => ({
    id,
    title: id,
    projectId: null,
    messageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  });
  const sessions = [
    session("pinned-outside", { pinned: true, updatedAt: 1 }),
    session("pinned-in-pinned-project", { pinned: true, projectId: "p1", updatedAt: 2 }),
    session("pinned-in-plain-project", { pinned: true, projectId: "p2", updatedAt: 3 }),
    session("archived-pinned", { pinned: true, archived: true, updatedAt: 4 }),
    session("not-pinned", { updatedAt: 5 }),
  ];

  const picked = selectPinnedSessions(sessions, new Set(["p1"]));

  assert.deepEqual(picked.map((item) => item.id), ["pinned-in-plain-project", "pinned-outside"]);
});

test("展开状态按行 id 记录，置顶副本与项目副本互不影响", () => {
  const pinned = project("pinned-app", { pinned: true });
  const expandedRows = new Set(["pinned:pinned-app"]);
  const deps = { ...projectDeps, isProjectExpanded: (rowId: string) => expandedRows.has(rowId) };

  assert.equal(createProjectSidebarItem(pinned, "pinned", deps).expanded, true);
  assert.equal(createProjectSidebarItem(pinned, "project", deps).expanded, false);
});

test("选中态只跟随用户点击的分组，回退到项目首次出现的分组", () => {
  const pinned = project("pinned-app", { pinned: true });
  const sectioned = project("sectioned-app", { sectionId: "sec-1" });
  const noSections = new Set<string>();
  const withSection = new Set(["sec-1"]);

  assert.equal(resolveActiveGroupKey(null, pinned, noSections), "pinned");
  assert.equal(resolveActiveGroupKey("project", pinned, noSections), "project");
  assert.equal(resolveActiveGroupKey("pinned", project("plain-app"), noSections), "project");
  assert.equal(resolveActiveGroupKey(sectionGroupKey("removed"), pinned, noSections), "pinned");
  assert.equal(resolveActiveGroupKey(null, sectioned, withSection), sectionGroupKey("sec-1"));
  assert.equal(resolveActiveGroupKey("project", sectioned, withSection), "project");
  assert.equal(resolveActiveGroupKey("project", null, noSections), null);
});

test("同一项目的两份副本只有 showActive 的那一行高亮", () => {
  const pinned = project("pinned-app", { pinned: true });
  const deps = { ...projectDeps, activeProjectId: pinned.id };

  assert.equal(createProjectSidebarItem(pinned, "project", { ...deps, showActive: true }).active, true);
  assert.equal(createProjectSidebarItem(pinned, "pinned", { ...deps, showActive: false }).active, false);
});

test("单击项目行时同步选中项目上下文并切换展开状态", () => {
  const app = project("app-1");
  const selected: string[] = [];
  const toggled: string[] = [];
  const item = createProjectSidebarItem(app, "project", {
    ...projectDeps,
    onSelectProjectContext: (target) => selected.push(target.id),
    onToggleProjectExpanded: (rowId) => toggled.push(rowId),
  });

  item.onClick?.();

  assert.deepEqual(selected, ["app-1"]);
  assert.deepEqual(toggled, ["project:app-1"]);
});

test("resolveNewChatProject 按当前项目上下文、活动会话与草稿绑定顺序继承项目", () => {
  const app1 = project("app-1", { sectionId: "sec-1" });
  const app2 = project("app-2");
  const sessions: WorkbenchChatSessionSummary[] = [
    { id: "s1", title: "在 app2", projectId: "app-2", messageCount: 1, createdAt: 0, updatedAt: 0 },
    { id: "s2", title: "项目外", projectId: null, messageCount: 1, createdAt: 0, updatedAt: 0 },
  ];

  // 优先沿用当前选中的项目上下文（即使处于其它会话或草稿）
  assert.equal(
    resolveNewChatProject({
      activeProjectId: "app-1",
      activeChatSessionId: "s1",
      chatSessions: sessions,
      draftProjectId: "app-2",
      projects: [app1, app2],
    })?.id,
    "app-1",
  );
  // 工作台未记录时兜底取活动会话所属项目
  assert.equal(
    resolveNewChatProject({
      activeProjectId: null,
      activeChatSessionId: "s1",
      chatSessions: sessions,
      draftProjectId: null,
      projects: [app1, app2],
    })?.id,
    "app-2",
  );
  // 活动会话为空时兜底取草稿绑定项目
  assert.equal(
    resolveNewChatProject({
      activeProjectId: null,
      activeChatSessionId: null,
      chatSessions: sessions,
      draftProjectId: "app-1",
      projects: [app1, app2],
    })?.id,
    "app-1",
  );
  // 全部为空或项目已删除时返回 null
  assert.equal(
    resolveNewChatProject({
      activeProjectId: "deleted",
      activeChatSessionId: "s2",
      chatSessions: sessions,
      draftProjectId: null,
      projects: [app1, app2],
    }),
    null,
  );
});