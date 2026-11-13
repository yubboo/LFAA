/**
 * 功能：回归通用 Work 路由、跨 App 工具发现与模型创建项目后的会话目录绑定。
 * 作用：隔离 SQLite 和真实临时文件夹，不连接 Provider、Daemon 或用户数据目录。
 * 关联文件：application-id.ts、core/tools、core/session、workspace Owner、Project Files Host。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "ai-work-unified-chat-projects");

test("所有 App 的聊天地址都归一到唯一通用 Work", async () => {
  const { APPLICATION_IDS, normalizeWorkRoute } = await import("lfaa-util-values/src/application-id.js");
  for (const appId of APPLICATION_IDS) {
    assert.equal(normalizeWorkRoute(`/apps/${appId}/ai-work`), "/work");
    assert.equal(normalizeWorkRoute(`/apps/${appId}/ai-work/history`), "/work");
  }
  assert.equal(normalizeWorkRoute("/apps/aivideo/normal"), "/apps/aivideo/normal");
  assert.equal(normalizeWorkRoute("/apps/writing/normal"), "/apps/writing/normal");
});

test("通用 Session 持久化领域 App 上下文，允许空闲切换而不改变会话 App", async () => {
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
  const { createAiTurn, finishAiAssistantMessage, getAiSession, listAiSessions, setAiSessionContextApplication } = await import("lfaa-session/src/sessions.js");
  const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
  const { aiChatMessageSchema, aiSessionContextApplicationSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
  const userId = randomUUID();
  retireLegacyFileTables();
  database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture','fixture','member')").run(userId, `fixture-${userId}`);

  const created = createAiTurn(userId, "workspace", null, "在 AI 漫剧里继续", false, null, undefined, undefined, "aivideo");
  assert.equal(created.session.appId, "workspace");
  assert.equal(created.session.contextApplicationId, "aivideo");
  assert.equal(database.prepare("SELECT context_application_id FROM ai_sessions WHERE id = ?").get(created.session.id).context_application_id, "aivideo");
  assert.equal(sessionRecords.allForSession("session_events", created.session.id).some(event => event.type === "session/application-context" && event.data.applicationId === "aivideo"), true);
  assert.equal(setAiSessionContextApplication(userId, created.session.id, "minecraft"), null, "活动 Run 不允许更改 Session 上下文");

  finishAiAssistantMessage(userId, created.session.id, created.assistantMessage.id, "已完成", "complete");
  const changed = setAiSessionContextApplication(userId, created.session.id, "minecraft");
  assert.equal(changed.contextApplicationId, "minecraft");
  assert.equal(getAiSession(userId, created.session.id).contextApplicationId, "minecraft");
  assert.equal(listAiSessions(userId, false).find(session => session.id === created.session.id).contextApplicationId, "minecraft");
  assert.equal(setAiSessionContextApplication("another-user", created.session.id, "aivideo"), null, "领域上下文仍按会话账户隔离");
  assert.equal(setAiSessionContextApplication(userId, created.session.id, null).contextApplicationId, null, "显式通用聊天可清除领域上下文");

  const baseInput = { appId: "workspace", sessionId: null, content: "继续" };
  assert.equal(aiChatMessageSchema.validate({ ...baseInput, contextApplicationId: "aivideo" }).error, undefined);
  assert.equal(aiChatMessageSchema.validate({ ...baseInput, contextApplicationId: "workspace" }).error !== undefined, true);
  assert.equal(aiSessionContextApplicationSchema.validate({ contextApplicationId: null }).error, undefined);
  assert.equal(aiSessionContextApplicationSchema.validate({ contextApplicationId: "unknown" }).error !== undefined, true);
});

test("通用 Work 可发现实际登记的 AI Video 工具并使用其声明的业务上下文", async () => {
  const { Context } = await import("@deepseek-ai/cordis");
  const { registerAiBusinessTool } = await import("lfaa-tools/src/registry.js");
  const { listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js");
  const owner = new Context();
  const fiber = await owner.plugin({ name: "fixture-unified-ai-video-tool", apply(ctx) {
    registerAiBusinessTool(ctx, {
      id: "fixture.aivideo.read-projects",
      name: "fixture_aivideo_read_projects",
      applicationIds: ["aivideo"],
      coreManaged: true,
      description: "读取隔离测试中的 AI Video 项目。",
      schema: { type: "object", properties: {}, additionalProperties: false },
      parse: value => value,
      risk: () => "read",
      approval: (_parameters, context) => ({ scopeKey: `fixture:${context.applicationId}`, scopeSummary: "fixture", summary: "读取隔离项目" }),
      execute: async (_parameters, context) => ({ applicationId: context.applicationId })
    });
  } });
  try {
    const tool = listAiBusinessTools("workspace", "member", null, "ask").find(item => item.name === "fixture_aivideo_read_projects");
    assert.ok(tool, "通用 Work 目录包含当前 Runtime 已登记的 AI Video 工具");
    assert.ok(tool.applicationIds.includes("workspace"), "统一 Permission Owner 能校验通用入口范围");
    assert.deepEqual(await tool.execute({}, { userId: "fixture-owner", userRole: "member", applicationId: "workspace", agentRunId: "fixture-run", signal: new AbortController().signal, onProgress() {} }), { applicationId: "aivideo" });
  } finally {
    await fiber.dispose();
  }
});

test("Agent 可在当前 Run 创建项目文件夹、登记并将同一会话切入新目录", async () => {
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
  retireLegacyFileTables();
  const { createAiTurn, getAiSession } = await import("lfaa-session/src/sessions.js");
  const { createLocalWorkspaceProject, getDefaultWorkspaceProjectId, getWorkspaceProject, listWorkspaceProjects, setDefaultWorkspaceProject } = await import("lfaa-workspace-workspace/src/index.js");
  const { listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js");
  const userId = randomUUID();
  database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture','fixture','member')").run(userId, `fixture-${userId}`);
  const parentPath = join(process.env.LFAA_HOME, "Documents", "lfaa");
  const defaultPath = join(parentPath, "default-workspace");
  mkdirSync(defaultPath, { recursive: true });
  const defaultProject = createLocalWorkspaceProject({ userId, title: "默认工作区", projectDirectoryPath: defaultPath, platform: process.platform });
  setDefaultWorkspaceProject(userId, defaultProject.id);
  const turn = createAiTurn(userId, "workspace", null, "开始一个长篇小说项目", false, {
    id: defaultProject.id, appId: "workspace", nodeId: null, path: defaultProject.path, title: defaultProject.title
  });
  const tool = listAiBusinessTools("workspace", "member", null, "full_access").find(item => item.name === "workspace_create_project");
  assert.ok(tool, "Workspace Project Owner 的创建工具由通用 Work 发现");
  let updatedRunProject = null;
  const executeLocalProjectFile = async input => {
    if (input.operation === "inspect_directory") return { path: parentPath, directory: true };
    assert.equal(input.operation, "create_directory");
    const path = join(input.path, input.name);
    mkdirSync(path);
    return { path, created: true };
  };
  const result = await tool.execute(tool.parse({ title: "星河小说" }), {
    userId,
    userRole: "member",
    applicationId: "workspace",
    agentRunId: turn.assistantMessage.id,
    sessionId: turn.session.id,
    signal: new AbortController().signal,
    executeLocalProjectFile,
    updateWorkspaceProject(project) { updatedRunProject = project; },
    onProgress() {}
  });
  assert.equal(result.created, true);
  assert.equal(result.linkedSession, true);
  assert.equal(dirname(getWorkspaceProject(userId, result.projectId, "workspace").path), dirname(defaultPath), "新项目与默认工作区位于同一个父目录");
  assert.equal(getAiSession(userId, turn.session.id).projectId, result.projectId, "当前活动会话已由 Session Owner 归入新项目");
  assert.equal(updatedRunProject.id, result.projectId, "本轮后续文件工具收到新项目上下文");
  assert.equal(getDefaultWorkspaceProjectId(userId), defaultProject.id, "默认工作区身份保持不变");
  assert.ok(listWorkspaceProjects(userId, "workspace").some(project => project.id === result.projectId), "项目列表展示真实登记结果");
});
