/**
 * 功能：验证 Agent 对设置中心的目录读取、单项更新和三种权限模式接入。
 * 作用：在隔离 Settings/Permission/Session Owner 中验证真实账户读写，不连接真实 Provider 或修改产品账户。
 * 关联文件：settings/settings/src/agent-settings.ts、core/tools/settings-tools.ts、core/agent-loop。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "agent-settings-tools");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();
const agentSettings = await import("lfaa-settings/src/agent-settings.js");
const { settingsTools } = await import("lfaa-tools/src/settings-tools.js");
const { projectFileTool } = await import("lfaa-tools/src/project-tools.js");
const { listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js");
const { SETTINGS_CENTER_MENUS } = await import("lfaa-util-values/src/settings-menu-catalog.js");
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const accountUsage = await import("lfaa-identity-auth/src/account-agent-usage.js");
const { createAiCompletionService } = await import("lfaa-llm/src/completion.js");
const permissions = await import("lfaa-permission-presets/src/permissions.js");
const { Context } = await import("@deepseek-ai/cordis");

const owner = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, 1, 'settings-agent-fixture', 'fixture', 'fixture', 'admin')").run(owner);
const memberId = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, 2, 'settings-agent-member-fixture', 'fixture', 'fixture', 'member')").run(memberId);
const ctx = new Context();
const approvalFiber = await ctx.plugin(await import("lfaa-user-approval/src/index.js"));
const account = { providerId: "openai", modelId: "fixture", chatUrl: "https://provider.example.test/chat", secret: "invalid-fixture-key", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens", reasoningMode: "default" };
const host = { llm: createAiCompletionService(), listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], listHooks: () => [], getSystemInstructions: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] }) };
const modelResolver = { resolve: () => account };
const callTool = (name, args) => ({ tool_calls: [{ index: 0, id: "settings-call", type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
test.after(async () => { await approvalFiber.dispose(); });

test("外观目录复用界面背景文案、展示纯色与账户私有选项，且读取不触发图片迁移", () => {
  const uploadedId = `user-${randomUUID()}`;
  const fixtureBytes = Buffer.from("isolated-background-metadata");
  database.prepare("INSERT INTO appearance_backgrounds (user_id, id, display_name, mime_type, image_data) VALUES (?, ?, ?, ?, ?)").run(owner, uploadedId, "隔离自定义背景", "image/png", fixtureBytes);

  const appearance = agentSettings.listAgentSettings(owner, { category: "appearance", limit: 50 });
  const login = appearance.entries.find(entry => entry.path === "appearance.backgrounds.login");
  const appCenter = appearance.entries.find(entry => entry.path === "appearance.backgrounds.appCenter");
  assert.ok(login);
  assert.ok(appCenter);
  assert.equal(login.label, "登录页（当前设备）背景图片");
  assert.deepEqual(login.menuLabels, ["外观"]);
  assert.ok(login.allowedValues.includes("none"));
  assert.deepEqual(login.allowedOptions.find(option => option.value === "none"), { value: "none", label: "纯色" });
  assert.ok(login.description.includes("不会改动其他位置"));
  assert.ok(!login.allowedValues.includes(uploadedId), "登录页只允许内置背景");
  assert.ok(appCenter.allowedOptions.some(option => option.value === uploadedId && option.label === "自定义 · 隔离自定义背景"));
  assert.equal(Buffer.from(database.prepare("SELECT image_data FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(owner, uploadedId).image_data).toString(), fixtureBytes.toString(), "Agent 目录读取不应执行图片文件迁移");
  assert.ok(agentSettings.listAgentSettings(owner, { query: "纯色" }).entries.some(entry => entry.path === "appearance.backgrounds.login"));

  const before = settings.getUserSettings(owner).appearance.backgrounds;
  const changed = agentSettings.updateAgentSetting(owner, "appearance.backgrounds.login", "none");
  const after = settings.getUserSettings(owner).appearance.backgrounds;
  assert.equal(changed.value, "none");
  assert.deepEqual(after, { ...before, login: "none" }, "Agent 只应修改用户明确指定的登录页背景位置");
  assert.throws(() => agentSettings.updateAgentSetting(owner, "appearance.backgrounds.appCenter", `user-${randomUUID()}`), /背景只能选择/u);
});

test("设置目录列出真实分类和值，隐藏由专属 Owner 管理的连接内容", () => {
  settings.saveUserSettings(owner, "plugins", { ...settings.getUserSettings(owner).plugins, mcpServers: [{ id: "private-fixture", name: "private-fixture", enabled: true, applicationIds: ["workspace"], transport: "stdio", command: "secret-command-fixture", args: ["private-argument"] }] });
  const root = agentSettings.listAgentSettings(owner);
  assert.equal(root.menus.length, 34);
  assert.deepEqual(root.menus.find(item => item.id === "appearance").toolSearchTerms, undefined);
  assert.equal(root.menus.find(item => item.id === "import").access, "settings-and-tools");
  assert.equal(root.menus.find(item => item.id === "snapshots").access, "settings-and-tools");
  for (const toolName of ["lfaa_settings_snapshot_list", "lfaa_settings_snapshot_create", "lfaa_settings_snapshot_preview", "lfaa_settings_snapshot_restore", "lfaa_settings_snapshot_delete"]) {
    assert.ok(settingsTools.some(tool => tool.name === toolName), `缺少 Agent Owner 工具 ${toolName}`);
  }
  assert.equal(root.menus.find(item => item.id === "parental").access, "settings-and-tools");
  assert.equal(root.menus.find(item => item.id === "mini").settingsCategory, "mini");
  assert.equal(root.menus.find(item => item.id === "cloudPreferences").access, "tools");
  assert.equal(root.menus.find(item => item.id === "trustedContacts").access, "partial");
  for (const toolName of ["lfaa_settings_trusted_contacts_list", "lfaa_settings_trusted_contact_remove", "lfaa_settings_trusted_recovery_approve"]) {
    assert.ok(settingsTools.some(tool => tool.name === toolName), `缺少 Agent Owner 工具 ${toolName}`);
  }
  assert.equal(root.menus.find(item => item.id === "security").access, "user-input");
  assert.ok(root.menus.find(item => item.id === "profile").toolSearchTerms.includes("个人资料"));
  assert.ok(root.menus.find(item => item.id === "usage").toolSearchTerms.includes("账户用量"));
  const appearanceMenu = agentSettings.listAgentSettings(owner, { menuId: "appearance", limit: 50 });
  assert.ok(appearanceMenu.entries.length > 0);
  assert.ok(appearanceMenu.entries.every(entry => entry.menuIds.includes("appearance")));
  const voiceMenu = agentSettings.listAgentSettings(owner, { menuId: "voice", limit: 50 });
  assert.deepEqual(voiceMenu.entries.map(entry => entry.path).sort(), ["aiRuntime.readResponsesAloud", "aiRuntime.voiceInputEnabled"]);
  const importMenu = agentSettings.listAgentSettings(owner, { menuId: "import" });
  assert.equal(importMenu.entries.length, 0);
  assert.equal(importMenu.menus[0].statusLabel, undefined);
  assert.equal(root.categories.some(item => item.id === "browser-use" && item.label === "浏览器"), true);
  assert.deepEqual(root.entries, []);
  const general = agentSettings.listAgentSettings(owner, { category: "general", limit: 50 });
  assert.ok(general.entries.some(entry => entry.path === "general.showServiceStatus" && entry.value === true && entry.writable));
  assert.ok(general.entries.some(entry => entry.path === "general.sendShortcut" && entry.allowedValues?.includes("enter")));
  const permissionsPage = agentSettings.listAgentSettings(owner, { category: "permissions" });
  assert.ok(permissionsPage.entries.some(entry => entry.path === "permissions.mode" && !entry.writable && entry.value === "ask"));
  const pluginsPage = agentSettings.listAgentSettings(owner, { category: "plugins" });
  assert.ok(pluginsPage.entries.some(entry => entry.path === "plugins.enabled" && !entry.writable && entry.ownerTool === "lfaa_set_capability_enabled"));
  const browserPage = agentSettings.listAgentSettings(owner, { category: "browser-use" });
  assert.ok(browserPage.entries.some(entry => entry.path === "browserUse.enabledProviderIds" && !entry.writable && entry.ownerTool === "lfaa_browser_manage_settings"));
  assert.ok(!JSON.stringify(pluginsPage).includes("secret-command-fixture"));
  assert.ok(!JSON.stringify(pluginsPage).includes("private-argument"));
  assert.ok(!pluginsPage.entries.some(entry => entry.path.startsWith("plugins.mcpServers") || entry.path.startsWith("plugins.prompts") || entry.path.startsWith("plugins.skillDirectories")));
  assert.ok(agentSettings.listAgentSettings(owner, { query: "showServiceStatus" }).entries.every(entry => entry.path.includes("showServiceStatus")));
});

test("單項更新走 Settings Owner 嚴格校驗與回讀，不可修改权限模式或替代能力 Owner", () => {
  const changed = agentSettings.updateAgentSetting(owner, "general.showServiceStatus", false);
  assert.equal(changed.changed, true);
  assert.equal(changed.value, false);
  assert.equal(settings.getUserSettings(owner).general.showServiceStatus, false);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "general.language", "fr-FR"), /设置内容格式不正确/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "permissions.mode", "full_access"), /由用户/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "plugins.mcpServers", []), /找不到该账户设置项/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "browserUse.enabledProviderIds", ["tabbit-personal"]), /Browser Owner 管理/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "browserUse.fullCdpAccess", true), /先由用户开启浏览器开发者模式/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "aiRuntime.subagentAccountId", "unknown-account"), /真实模型路由目录/u);
  assert.throws(() => agentSettings.updateAgentSetting(owner, "aiRuntime.imageGenerationModelId", "unknown-model"), /真实模型目录/u);
  assert.equal(settings.getUserSettings(owner).permissions.mode, "ask");
  assert.equal(settings.getUserSettings(owner).general.showServiceStatus, false);
});

test("Mini 设置走 Settings Owner，自托管同步状态按账户读取且 Web 不伪报桌面窗口", async () => {
  const miniFields = agentSettings.listAgentSettings(owner, { menuId: "mini", limit: 20 });
  assert.deepEqual(miniFields.entries.map(entry => entry.path).sort(), [
    "mini.alwaysOnTop", "mini.companion", "mini.opacity", "mini.showCompanion"
  ]);
  assert.ok(miniFields.entries.find(entry => entry.path === "mini.companion")?.allowedOptions?.some(option => option.value === "cloud" && option.label === "云朵"));

  const changed = agentSettings.updateAgentSetting(owner, "mini.opacity", 72);
  assert.equal(changed.value, 72);
  assert.equal(settings.getUserSettings(owner).mini.opacity, 72);

  const miniTool = settingsTools.find(tool => tool.name === "lfaa_settings_mini_window");
  assert.ok(miniTool);
  assert.equal(miniTool.risk({ action: "open" }), "write");
  await assert.rejects(
    miniTool.execute({ action: "open" }, { userId: owner, signal: new AbortController().signal }),
    /当前 Agent Host 未连接 Electron Mini 窗口 Owner/u,
    "Web Host 必须返回不支持，而不是模拟 Mini 已打开"
  );

  const syncTool = settingsTools.find(tool => tool.name === "lfaa_settings_sync_status");
  assert.ok(syncTool);
  const result = await syncTool.execute({}, { userId: owner, signal: new AbortController().signal });
  assert.equal(result.service, "lfaa-self-hosted");
  assert.equal(result.scope, "same-control-plane");
  assert.ok(result.categories.includes("mini"));
  assert.equal(JSON.stringify(result).includes("fixture-only-key"), false);
});

test("Agent 工具目录公开设置读写合同并区分只读、普通写与访问扩张风险", () => {
  const names = listAiBusinessTools("workspace", "admin").map(tool => tool.name);
  assert.ok(names.includes("lfaa_settings_list"));
  assert.ok(names.includes("lfaa_settings_update"));
  const list = settingsTools.find(tool => tool.name === "lfaa_settings_list");
  const update = settingsTools.find(tool => tool.name === "lfaa_settings_update");
  assert.equal(list.risk({}), "read");
  assert.equal(update.risk({ path: "general.showServiceStatus", value: false }), "write");
  assert.equal(update.risk({ path: "browserUse.allowAgentHistoryAccess", value: true }), "dangerous");
  assert.equal(update.risk({ path: "browserUse.sitePermissionDefaults.camera", value: "allow" }), "dangerous");
  assert.equal(update.risk({ path: "browserUse.fullCdpAccess", value: true }), "dangerous");
  assert.equal(update.risk({ path: "browserUse.sitePermissionDefaults.camera", value: "ask" }), "write");
  const approval = update.approval({ path: "general.showServiceStatus", value: false }, { userId: owner, applicationId: "workspace" });
  assert.match(approval.scopeKey, /^settings:/u);
  assert.match(approval.summary, /general\.showServiceStatus/u);
  assert.ok(!approval.summary.includes("false"));
});

test("代码审查菜单路由到当前会话 Git 差异并保持只读边界", () => {
  const menu = SETTINGS_CENTER_MENUS.find(item => item.id === "codeReview");
  assert.equal(menu?.access, "tools");
  assert.ok(menu?.toolSearchTerms?.includes(projectFileTool.name));
  assert.match(projectFileTool.description, /代码审查[\s\S]*真实变更/u);
  assert.match(projectFileTool.description, /不会自动应用补丁、提交或推送/u);
  assert.match(projectFileTool.description, /没有绑定仓库或差异不可用时如实停止/u);
});

test("钩子菜单读取当前 Host 的真实 AI Runtime Hook 目录且只返回只读元数据", async () => {
  const menu = SETTINGS_CENTER_MENUS.find(item => item.id === "hooks");
  const tool = settingsTools.find(item => item.name === "lfaa_settings_runtime_hooks_list");
  assert.equal(menu?.access, "tools");
  assert.ok(menu?.toolSearchTerms?.includes("AI Runtime Hooks"));
  assert.ok(tool);
  assert.equal(tool.risk({}), "read");
  const hooks = [{ id: "fixture.route", events: ["requestRoute"] }];
  assert.deepEqual(await tool.execute({}, { signal: new AbortController().signal, listRuntimeHooks: () => hooks }), {
    source: "ai-runtime-hook-owner", count: 1, hooks
  });
  await assert.rejects(tool.execute({}, { signal: new AbortController().signal }), /没有提供 AI Runtime Hook Owner/u);
  assert.match(tool.description, /不返回或调用插件回调，不创建或修改钩子/u);
});

async function runUpdate(mode, path, value, remember = false) {
  settings.saveUserSettings(owner, "permissions", { mode });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, retryDelaySeconds: 0 });
  const turn = sessions.createAiTurn(owner, "workspace", null, "更新一项设置的隔离验收");
  const nativeFetch = globalThis.fetch;
  const bodies = [];
  const events = [];
  let approvals = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (bodies.length === 1) {
      const toolNames = body.tools?.map(item => item.function.name) ?? [];
      assert.ok(toolNames.includes("lfaa_settings_update"));
      assert.ok(toolNames.includes("lfaa_settings_list"));
      return sse(callTool("lfaa_settings_update", { path, value }));
    }
    return sse({ content: "已根据 Settings Owner 返回值完成隔离设置操作。" });
  };
  try {
    await executeAiTurn({
      userId: owner,
      userRole: "admin",
      body: { appId: "workspace", sessionId: turn.session.id, content: "请更新隔离设置" },
      turn,
      aiPluginHost: host,
      abortController: new AbortController(),
      emit(event, data) {
        events.push({ event, data });
        if (event === "activity" && data.activity.status === "approval_required" && !data.activity.approvalAnswer) {
          approvals++;
          const pending = permissions.listAiToolApprovals(owner, "pending").find(item => item.id === data.activity.approvalId);
          assert.ok(pending);
          assert.ok(pending.summary.includes(path));
          assert.ok(permissions.decideAiToolApproval(owner, pending.id, "approved", remember));
          ctx.lfaaUserApproval.notify(owner, pending.id);
        }
      },
      modelResolver,
      approvalNotifications: ctx.lfaaUserApproval
    });
    const valueAtPath = path.split(".").reduce((value, key) => value?.[key], settings.getUserSettings(owner));
    return { approvals, value: valueAtPath, bodies, events };
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

test("Agent 写设置沿用 ask 和 full_access；完全权限按用户目标直接执行", async () => {
  const ask = await runUpdate("ask", "general.showServiceStatus", false);
  assert.equal(ask.approvals, 1);
  assert.equal(ask.value, false);
  assert.ok(ask.events.some(item => item.event === "capability-settings" && item.data.changed === true), "Agent settings update invalidates client settings snapshot");
  const full = await runUpdate("full_access", "browserUse.developerMode", true);
  assert.equal(full.approvals, 0);
  assert.equal(full.value, true);
  assert.equal(settings.getUserSettings(owner).permissions.mode, "full_access");
  const rememberedFirst = await runUpdate("approve_remembered", "general.showServiceStatus", false);
  const rememberedSecond = await runUpdate("approve_remembered", "general.showServiceStatus", false);
  const rememberedThird = await runUpdate("approve_remembered", "general.showServiceStatus", false);
  assert.equal(rememberedFirst.approvals, 1);
  assert.equal(rememberedSecond.approvals, 1);
  assert.equal(rememberedThird.approvals, 0, "same exact setting path and value use Permission Owner memory after two approvals");
  assert.equal(settings.getUserSettings(owner).permissions.mode, "approve_remembered");
});

test("家长控制会在 Agent Provider 请求前拒绝非允许时段，且不更改用户权限模式", async () => {
  accountUsage.saveAgentUsagePolicy(owner, memberId, {
    enabled: true,
    timezone: "UTC",
    dailyLimitMinutes: 60,
    weeklyWindows: Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "21:00" }))
  });
  const turn = sessions.createAiTurn(memberId, "workspace", null, "读取一项设置的隔离验收");
  const nativeFetch = globalThis.fetch;
  const events = [];
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("家长控制不允许派发 Provider 请求"); };
  try {
    await executeAiTurn({
      userId: memberId,
      userRole: "member",
      body: { appId: "workspace", sessionId: turn.session.id, content: "读取我的设置" },
      turn,
      aiPluginHost: host,
      abortController: new AbortController(),
      emit(event, data) { events.push({ event, data }); },
      modelResolver,
      approvalNotifications: ctx.lfaaUserApproval
    });
  } finally { globalThis.fetch = nativeFetch; }
  assert.equal(providerCalls, 0);
  assert.ok(events.some(item => item.event === "delta" && String(item.data.delta).includes("当前不在家长控制允许的 Agent 使用时段内")));
  assert.equal(settings.getUserSettings(memberId).permissions.mode, "ask", "家长控制不能写入或覆盖统一权限模式");
});
