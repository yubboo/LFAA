/**
 * 功能：覆盖 Agent 自主发现、加载、预览并操作当前工作区 HTML 的完整隔离链路。
 * 作用：使用合成 Provider 和临时账户/目录驱动真实 Browser Owner，不访问真实账户或项目。
 * 关联文件：agent-loop、browser-use、project-files、Permission Owner。
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "agent-browser-preview");

const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { config } = await import("lfaa-launch-environment/src/config.js");
const { getLocalDaemonNodeId, isLocalDaemonIdentity } = await import("lfaa-host-daemon/src/node-credentials.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const { createAiCompletionService } = await import("lfaa-llm/src/completion.js");
const { registerAiBusinessTool, listRegisteredAiTools } = await import("lfaa-tools/src/registry.js");
const { projectFileTool } = await import("lfaa-tools/src/project-tools.js");
const { BrowserSessionManager } = await import("lfaa-browser-use");
const { createBrowserTools } = await import("lfaa-browser-use/src/browser-tools.js");
const { createProjectPreviewServer, executeProjectFile } = await import("lfaa-host-project-files/src/project-files.mjs");
const { createSkillTools } = await import("lfaa-tool-skill/src/index.js");
const { apply: applyCapabilityInstalls } = await import("lfaa-capability-installs/src/index.js");
const { createProjectSkillAdapter } = await import("lfaa-capability-skill/src/index.js");

const owner = "isolated-agent-browser-preview";
const uid = 1731;
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, ?, ?, 'fixture', 'fixture', 'admin')")
  .run(owner, uid, "isolated-agent-browser-preview");

const disposers = [];
const toolOwner = { effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; } };
const account = {
  providerId: "openai", modelId: "fixture", chatUrl: "https://provider.example.test/chat", secret: "invalid-fixture-key",
  keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens", reasoningMode: "default"
};
const modelResolver = { resolve: () => account };
const providerCall = (name, args, id = name) => ({ tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
const resultText = content => typeof content === "string" ? content
  : Array.isArray(content) ? content.filter(item => item?.type === "text").map(item => item.text).join("\n")
  : JSON.stringify(content ?? "");

test("仅精确匹配隔离 Home 的本机 Daemon 身份；未知节点不当作本机", async () => {
  const nodeId = randomUUID();
  const credentials = join(config.homeDirectory, "credentials");
  await mkdir(credentials, { recursive: true });
  await writeFile(join(credentials, "daemon-node-id"), nodeId, "utf8");
  assert.equal(getLocalDaemonNodeId(), nodeId);
  assert.equal(isLocalDaemonIdentity(nodeId), true);
  assert.equal(isLocalDaemonIdentity(randomUUID()), false);
  assert.equal(isLocalDaemonIdentity(null), false);
});

test("Agent 通过真实工具循环打开临时 HTML、读取页面并点击按钮", async t => {
  const manager = new BrowserSessionManager(true);
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available)
    ?? manager.listProviders().find(item => item.id === "lfaa-managed-chrome" && item.available);
  if (!provider) {
    await manager.closeAll();
    return t.skip("当前系统没有可启动的隔离 Edge/Chrome");
  }

  for (const tool of createBrowserTools(manager)) registerAiBusinessTool(toolOwner, tool);

  const root = await mkdtemp(join(tmpdir(), "lfaa-agent-browser-preview-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<!doctype html><html><head><meta charset=\"utf-8\"><title>Agent 预览验收</title></head><body><h1>预览页面已打开</h1><button type=\"button\">计数</button><output id=\"result\">尚未点击</output><script>let count=0;document.querySelector('button').addEventListener('click',()=>{count++;document.querySelector('#result').textContent='点击 '+count+' 次'});</script></body></html>");
  t.after(async () => { await manager.closeAll(); await rm(root, { recursive: true, force: true }); });

  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "browser-use", { ...settings.getUserSettings(owner).browserUse, enabled: true, enabledProviderIds: [provider.id] });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, retryDelaySeconds: 0, maxModelRequests: 10, maxToolCalls: 10 });

  const project = { id: "isolated-preview-project", appId: "workspace", nodeId: null, path: root, title: "隔离预览项目" };
  const turn = sessions.createAiTurn(owner, "workspace", null, "请打开 index.html，检查页面并点击计数按钮。", false, project);
  const nativeFetch = globalThis.fetch;
  const requests = [];
  let providerFailure = null;
  let previewCloseCount = 0;
  globalThis.fetch = async (url, options) => {
    try {
    assert.equal(String(url), account.chatUrl);
    const body = JSON.parse(options.body);
    requests.push(body);
    const names = body.tools?.map(tool => tool.function.name) ?? [];
    const toolResults = body.messages.filter(message => message.role === "tool");
    const lastResult = resultText(toolResults.at(-1)?.content);

    switch (requests.length) {
      case 1:
        assert.ok(names.includes("lfaa_tools_list"));
        assert.ok(!names.includes("lfaa_browser_open_workspace_file"));
        return sse(providerCall("lfaa_tools_list", { query: "HTML 工作区 浏览器预览" }));
      case 2:
        assert.ok(names.includes("lfaa_tools_load"));
        assert.match(lastResult, /lfaa_browser_open_workspace_file/u);
        return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_open_workspace_file"] }));
      case 3:
        assert.ok(names.includes("lfaa_browser_open_workspace_file"));
        assert.match(JSON.stringify(body.messages), /隔离预览项目/u);
        return sse(providerCall("lfaa_browser_open_workspace_file", { providerId: provider.id, path: "index.html" }));
      case 4:
        assert.match(lastResult, /预览页面已打开/u);
        assert.match(lastResult, /计数/u);
        assert.ok(names.includes("lfaa_tools_list"));
        return sse(providerCall("lfaa_tools_list", { query: "browser click button" }));
      case 5:
        assert.match(lastResult, /lfaa_browser_click/u, `浏览器点击工具没有出现在发现结果：${lastResult.slice(0, 1200)}`);
        return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_click"] }));
      case 6:
        assert.ok(names.includes("lfaa_browser_click"));
        return sse(providerCall("lfaa_browser_click", { providerId: provider.id, role: "button", name: "计数" }));
      case 7:
        assert.match(lastResult, /点击 1 次/u);
        return sse({ content: "已打开 index.html，并根据页面实际按钮完成点击；页面显示“点击 1 次”。" });
      default:
        throw new Error(`Agent 意外请求了第 ${requests.length} 轮 Provider`);
    }
    } catch (error) {
      providerFailure = error;
      return sse({ content: "隔离 Provider 夹具发现断言失败。" });
    }
  };

  try {
    const pluginHost = {
      llm: createAiCompletionService(),
      createLocalProjectPreview: async (nodeId, directory, relativePath) => {
        assert.equal(nodeId, null, "隔离默认工作区不依赖 Daemon 节点");
        assert.equal(directory, root);
        const preview = await createProjectPreviewServer(directory, relativePath);
        return { url: preview.url, close: async () => { previewCloseCount++; await preview.close(); } };
      },
      listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], listHooks: () => [],
      getSystemInstructions: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] })
    };
    await executeAiTurn({
      userId: owner,
      userRole: "admin",
      body: { appId: "workspace", sessionId: turn.session.id, content: "打开 index.html 并验证计数按钮。" },
      turn,
      aiPluginHost: pluginHost,
      abortController: new AbortController(),
      emit() {},
      modelResolver
    });
    assert.equal(providerFailure, null, providerFailure?.message ?? "");
    assert.equal(requests.length, 7, "Agent 完成工具发现、加载、预览、点击和最终答复");
    assert.match(sessions.getAiRun(owner, turn.assistantMessage.id).message.content, /点击 1 次/u);
    assert.match(JSON.stringify(requests[6].messages), /点击 1 次/u, "页面操作真实结果进入下一轮 Provider 上下文");
    const results = await sessions.getAiQueryEventsPage(owner, turn.session.id, turn.session.id, { after: 0, limit: 100 });
    assert.ok(results.events.some(event => event.type === "tool/call" && event.data.name === "lfaa_browser_open_workspace_file"));
    assert.ok(results.events.some(event => event.type === "tool/result" && event.data.executionState === "complete"));
  } finally {
    globalThis.fetch = nativeFetch;
    await manager.closeAll();
    for (const dispose of disposers.splice(0)) dispose();
  }

  assert.equal(previewCloseCount, 1, "Agent Run 结束后关闭隔离 Browser Session 会回收临时 HTTP 服务");
});

test("Agent 完成 HTML 创建、实页找错、摘要保护修复和重新验证", async t => {
  const manager = new BrowserSessionManager(true);
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available)
    ?? manager.listProviders().find(item => item.id === "lfaa-managed-chrome" && item.available);
  if (!provider) {
    await manager.closeAll();
    return t.skip("当前系统没有可启动的隔离 Edge/Chrome");
  }

  for (const tool of createBrowserTools(manager)) registerAiBusinessTool(toolOwner, tool);
  const root = await mkdtemp(join(tmpdir(), "lfaa-agent-browser-dev-loop-"));
  t.after(async () => { await manager.closeAll(); await rm(root, { recursive: true, force: true }); });

  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "browser-use", { ...settings.getUserSettings(owner).browserUse, enabled: true, enabledProviderIds: [provider.id] });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, retryDelaySeconds: 0, maxModelRequests: 24, maxToolCalls: 24 });

  const project = { id: "isolated-dev-loop-project", appId: "workspace", nodeId: null, path: root, title: "隔离开发循环项目" };
  const turn = sessions.createAiTurn(owner, "workspace", null, "创建一个 HTML 计数器，在浏览器检查并修复问题后复测。", false, project);
  const nativeFetch = globalThis.fetch;
  const requests = [];
  let providerFailure = null;
  let previewCloseCount = 0;
  let previewUrl = "";
  const brokenPage = "<!doctype html><html><head><meta charset=\"utf-8\"><title>开发循环</title></head><body><h1>计数器</h1><button type=\"button\">增加 1</button><output id=\"count\">计数：0</output><script>let count=0;document.querySelector('#missing-button').addEventListener('click',()=>{count++;document.querySelector('#count').textContent='计数：'+count;});</script></body></html>";
  const fixedPage = "<!doctype html><html><head><meta charset=\"utf-8\"><title>开发循环</title></head><body><h1>计数器</h1><button type=\"button\">增加 1</button><output id=\"count\">计数：0</output><script>let count=0;document.querySelector('button').addEventListener('click',()=>{count++;document.querySelector('#count').textContent='计数：'+count;});</script></body></html>";

  globalThis.fetch = async (url, options) => {
    try {
      assert.equal(String(url), account.chatUrl);
      const body = JSON.parse(options.body);
      requests.push(body);
      const names = body.tools?.map(tool => tool.function.name) ?? [];
      const toolResults = body.messages.filter(message => message.role === "tool");
      const lastResult = resultText(toolResults.at(-1)?.content);
      switch (requests.length) {
        case 1:
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "项目文件工具 project_file_operation 创建 HTML" }));
        case 2:
          assert.match(lastResult, /project_file_operation/u);
          return sse(providerCall("lfaa_tools_load", { names: ["project_file_operation"] }));
        case 3:
          assert.ok(names.includes("project_file_operation"));
          return sse(providerCall("project_file_operation", { operation: "create", path: "index.html", content: brokenPage }));
        case 4:
          assert.match(lastResult, /created|sha256/u);
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "浏览器打开当前工作区 HTML" }));
        case 5:
          assert.match(lastResult, /lfaa_browser_open_workspace_file/u);
          return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_open_workspace_file"] }));
        case 6:
          assert.ok(names.includes("lfaa_browser_open_workspace_file"));
          return sse(providerCall("lfaa_browser_open_workspace_file", { providerId: provider.id, path: "index.html" }));
        case 7:
          assert.match(lastResult, /计数：0/u);
          previewUrl = JSON.parse(lastResult.slice(lastResult.indexOf("{"))).url;
          assert.match(previewUrl, /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/u);
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "browser click button" }));
        case 8:
          assert.match(lastResult, /lfaa_browser_click/u);
          return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_click"] }));
        case 9:
          assert.ok(names.includes("lfaa_browser_click"));
          return sse(providerCall("lfaa_browser_click", { providerId: provider.id, role: "button", name: "增加 1" }));
        case 10:
          assert.match(lastResult, /计数：0/u, "真实页面结果显示按钮没有触发计数变化");
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "读取 index.html 最新 sha256 后修复点击事件" }));
        case 11:
          assert.match(lastResult, /project_file_operation/u);
          return sse(providerCall("lfaa_tools_load", { names: ["project_file_operation"] }));
        case 12:
          assert.ok(names.includes("project_file_operation"));
          return sse(providerCall("project_file_operation", { operation: "read", path: "index.html" }));
        case 13: {
          const read = JSON.parse(toolResults.at(-1)?.content);
          assert.equal(read?.result?.content, brokenPage, "Agent 修复前必须读取真实工作区文件");
          assert.match(lastResult, /sha256/u);
          return sse(providerCall("project_file_operation", { operation: "write", path: "index.html", sha256: read.result.sha256, content: fixedPage }));
        }
        case 14:
          assert.match(lastResult, /changed.*true|sha256/u);
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "browser open" }));
        case 15:
          assert.match(lastResult, /lfaa_browser_open/u);
          return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_open"] }));
        case 16:
          assert.ok(names.includes("lfaa_browser_open"));
          return sse(providerCall("lfaa_browser_open", { providerId: provider.id, url: previewUrl }));
        case 17:
          assert.match(lastResult, /计数：0/u);
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "browser press key" }));
        case 18:
          assert.match(lastResult, /lfaa_browser_press_key/u);
          return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_press_key"] }));
        case 19:
          assert.ok(names.includes("lfaa_browser_press_key"));
          return sse(providerCall("lfaa_browser_press_key", { providerId: provider.id, key: "Tab" }));
        case 20:
          assert.match(lastResult, /计数：0/u);
          return sse(providerCall("lfaa_browser_press_key", { providerId: provider.id, key: "Enter" }));
        case 21:
          assert.match(lastResult, /计数：1/u, "修复后的实际页面点击结果必须回到 Provider");
          return sse({ content: "已在临时项目创建并预览计数器；第一次点击发现事件监听器选择了不存在的元素。读取最新摘要后修复并重开页面，复测显示计数：1。" });
        default:
          throw new Error(`Agent 意外请求了第 ${requests.length} 轮 Provider`);
      }
    } catch (error) {
      providerFailure = error;
      return sse({ content: "隔离开发循环 Provider 夹具发现断言失败。" });
    }
  };

  try {
    const pluginHost = {
      llm: createAiCompletionService(),
      executeLocalProjectFile: input => executeProjectFile(input),
      createLocalProjectPreview: async (nodeId, directory, relativePath) => {
        assert.equal(nodeId, null, "隔离项目必须独立于 Daemon 节点");
        assert.equal(directory, root);
        const preview = await createProjectPreviewServer(directory, relativePath);
        return { url: preview.url, close: async () => { previewCloseCount++; await preview.close(); } };
      },
      listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], listHooks: () => [],
      getSystemInstructions: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] })
    };
    await executeAiTurn({
      userId: owner,
      userRole: "admin",
      body: { appId: "workspace", sessionId: turn.session.id, content: "创建并修复 HTML 计数器。" },
      turn,
      aiPluginHost: pluginHost,
      abortController: new AbortController(),
      emit() {},
      modelResolver
    });
    assert.equal(providerFailure, null, providerFailure?.message ?? "");
    assert.equal(requests.length, 21, "Agent 必须完成项目工具发现、创建、浏览器实页修复、复验和最终答复");
    assert.match(await readFile(join(root, "index.html"), "utf8"), /querySelector\('button'\)/u);
    assert.match(sessions.getAiRun(owner, turn.assistantMessage.id).message.content, /计数：1/u);
    const results = await sessions.getAiQueryEventsPage(owner, turn.session.id, turn.session.id, { after: 0, limit: 100 });
    assert.ok(results.events.some(event => event.type === "tool/call" && event.data.name === "project_file_operation"));
    assert.ok(results.events.some(event => event.type === "tool/call" && event.data.name === "lfaa_browser_open_workspace_file"));
    assert.ok(results.events.some(event => event.type === "tool/call" && event.data.name === "lfaa_browser_press_key"));
  } finally {
    globalThis.fetch = nativeFetch;
    await manager.closeAll();
    for (const dispose of disposers.splice(0)) dispose();
  }

  assert.equal(previewCloseCount, 1, "关闭 Browser Session 后，临时 HTTP 服务已回收");
});

test("Skill 在同一 Agent Run 安装、发现、加载并引导调用真实隔离浏览器", async t => {
  const manager = new BrowserSessionManager(true);
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available)
    ?? manager.listProviders().find(item => item.id === "lfaa-managed-chrome" && item.available);
  if (!provider) {
    await manager.closeAll();
    return t.skip("当前系统没有可启动的隔离 Edge/Chrome");
  }

  const root = await mkdtemp(join(tmpdir(), "lfaa-skill-browser-same-run-"));
  await writeFile(join(root, "index.html"), "<!doctype html><html><head><meta charset=\"utf-8\"><title>Skill 安装后浏览器页</title></head><body><h1>页面来自隔离项目</h1><p>浏览器已读取真实页面内容。</p><button type=\"button\">增加计数</button><output id=\"counter\">点击前 0 次</output><output id=\"scroll-status\">滚动位置：0</output><main style=\"height:2400px\">长页面用于滚动验收</main><script>let count=0;document.querySelector('button').addEventListener('click',()=>{count++;document.querySelector('#counter').textContent='点击后 '+count+' 次'});window.addEventListener('scroll',()=>{document.querySelector('#scroll-status').textContent='滚动位置：'+Math.round(window.scrollY)});</script></body></html>");
  t.after(async () => { await manager.closeAll(); await rm(root, { recursive: true, force: true }); });

  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "plugins", { ...settings.getUserSettings(owner).plugins, enabled: true });
  settings.saveUserSettings(owner, "browser-use", { ...settings.getUserSettings(owner).browserUse, enabled: true, enabledProviderIds: [provider.id] });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, retryDelaySeconds: 0, maxModelRequests: 14, maxToolCalls: 16 });

  const project = { id: "isolated-skill-browser-project", appId: "workspace", nodeId: null, path: root, title: "隔离 Skill 浏览器项目" };
  const turn = sessions.createAiTurn(owner, "workspace", null, "安装这个临时 Browser Skill，再用它检查 index.html。", false, project);
  const skillMarkdown = [
    "---", "name: browser-check", "description: 使用已接入的 LFAA 浏览器检查当前项目网页", "---", "",
    "# 浏览器检查", "当用户要求检查当前项目 HTML 时，使用 LFAA 已登记的浏览器工具打开 `index.html`，读取页面标题和正文后如实报告。",
    "本 Skill 只提供方法资料；不要执行附属脚本，也不要调用未登记的外部浏览器代理。"
  ].join("\n");
  const snapshot = {
    repository: { url: "https://github.com/fixture/browser-check", name: "browser-check", license: "MIT" },
    requestedRef: "main", commit: "b".repeat(40), archiveSha256: "c".repeat(64),
    files: [
      { path: "skills/browser-check/SKILL.md", contents: Buffer.from(skillMarkdown) },
      { path: "skills/browser-check/scripts/check.mjs", contents: Buffer.from("throw new Error('Skill 附属脚本不得被安装流程执行');") }
    ]
  };
  const projectFileCalls = [];
  const lifecycleContext = {
    effect(setup) { return toolOwner.effect(setup); },
    provide(name, service) { this[name] = service; return this; },
    get() { return undefined; },
    lfaaTools: { registerTool(_owner, tool) { registerAiBusinessTool(toolOwner, tool); } }
  };
  applyCapabilityInstalls(lifecycleContext);
  lifecycleContext.lfaaCapabilityInstalls.register(toolOwner, createProjectSkillAdapter({
    downloadSnapshot: async () => snapshot,
    searchRepositories: async () => [],
    runProjectFile: async (input, context) => {
      const prepared = projectFileTool.prepare(input, context);
      const result = await projectFileTool.execute(prepared, context);
      projectFileCalls.push({ operation: input.operation, rootDirectory: prepared.rootDirectory, result });
      return result;
    }
  }));
  const registeredNames = new Set(listRegisteredAiTools().map(tool => tool.name));
  for (const tool of [...createSkillTools(), ...createBrowserTools(manager)]) {
    if (!registeredNames.has(tool.name)) registerAiBusinessTool(toolOwner, tool);
    registeredNames.add(tool.name);
  }

  const nativeFetch = globalThis.fetch;
  const requests = [];
  let providerFailure = null;
  let previewCloseCount = 0;
  globalThis.fetch = async (url, options) => {
    try {
      assert.equal(String(url), account.chatUrl);
      const body = JSON.parse(options.body);
      requests.push(body);
      const names = body.tools?.map(tool => tool.function.name) ?? [];
      const toolResults = body.messages.filter(message => message.role === "tool");
      const lastResult = resultText(toolResults.at(-1)?.content);
      switch (requests.length) {
        case 1:
          assert.ok(names.includes("capability_inspect"));
          return sse(providerCall("capability_inspect", { kind: "skill", source: snapshot.repository.url, ref: "main", targetApplicationId: "workspace" }, "skill-inspect"));
        case 2: {
          const inspection = JSON.parse(lastResult);
          assert.equal(inspection.resolvedRef, snapshot.commit);
          assert.match(lastResult, /browser-check/u);
          assert.ok(names.includes("capability_install"));
          return sse(providerCall("capability_install", { kind: "skill", inspectionId: inspection.inspectionId, targetApplicationId: "workspace" }, "skill-install"));
        }
        case 3:
          assert.match(lastResult, /verified_ready/u, JSON.stringify(projectFileCalls));
          assert.match(lastResult, /scriptsExecuted\\?":false/u);
          assert.ok(names.includes("lfaa_skill_list"));
          return sse(providerCall("lfaa_skill_list", { source: "project" }, "skill-list"));
        case 4:
          assert.match(lastResult, /browser-check/u, "安装后的 Skill 必须由同一项目 Owner 发现");
          assert.ok(names.includes("lfaa_skill_load"));
          return sse(providerCall("lfaa_skill_load", { source: "project", path: ".agents/skills/browser-check/SKILL.md" }, "skill-load"));
        case 5:
          assert.match(lastResult, /LFAA 已登记的浏览器工具/u, "同一 Run 必须能加载刚安装的 Skill 指引");
          assert.match(lastResult, /lfaa_browser_navigate/u, "通用 Skill 执行边界必须把网页导航语义映射到已登记的 Browser Owner 工具");
          assert.match(lastResult, /lfaa_browser_observe/u, "通用 Skill 执行边界必须把页面读取语义映射到已登记的 Browser Owner 工具");
          assert.match(lastResult, /lfaa_browser_click/u, "通用 Skill 执行边界必须要求先观察再用可访问角色/名称点击");
          assert.match(lastResult, /lfaa_browser_scroll/u, "通用 Skill 执行边界必须把滚动语义映射到已登记的 Browser Owner 工具");
          assert.ok(names.includes("lfaa_tools_list"));
          return sse(providerCall("lfaa_tools_list", { query: "", limit: 40 }, "browser-discovery"));
        case 6:
          for (const name of ["lfaa_browser_open_workspace_file", "lfaa_browser_navigate", "lfaa_browser_observe", "lfaa_browser_click", "lfaa_browser_scroll"]) assert.match(lastResult, new RegExp(name, "u"));
          return sse(providerCall("lfaa_tools_load", { names: ["lfaa_browser_open_workspace_file", "lfaa_browser_navigate", "lfaa_browser_observe", "lfaa_browser_click", "lfaa_browser_scroll"] }, "browser-load"));
        case 7:
          for (const name of ["lfaa_browser_open_workspace_file", "lfaa_browser_navigate", "lfaa_browser_observe", "lfaa_browser_click", "lfaa_browser_scroll"]) assert.ok(names.includes(name), `${name} 必须由当前工具目录实际提供`);
          return sse(providerCall("lfaa_browser_open_workspace_file", { providerId: provider.id, path: "index.html" }, "browser-open"));
        case 8:
          assert.match(lastResult, /Skill 安装后浏览器页/u);
          assert.match(lastResult, /页面来自隔离项目/u);
          {
            const payload = JSON.parse(lastResult.slice(lastResult.indexOf("：") + 1));
            assert.match(payload.url, /^http:\/\/127\.0\.0\.1:/u);
            return sse(providerCall("lfaa_browser_navigate", { providerId: provider.id, url: payload.url }, "browser-navigate"));
          }
        case 9:
          assert.match(lastResult, /Skill 安装后浏览器页/u);
          assert.match(lastResult, /增加计数/u);
          return sse(providerCall("lfaa_browser_observe", { providerId: provider.id }, "browser-observe"));
        case 10: {
          const observation = JSON.parse(lastResult.slice(lastResult.indexOf("：") + 1));
          assert.equal(observation.title, "Skill 安装后浏览器页");
          assert.match(observation.pageText, /页面来自隔离项目/u);
          const button = observation.controls.find(control => control.role === "button" && control.name === "增加计数");
          assert.ok(button, "点击目标必须来自真实隔离页面返回的可访问控件清单");
          return sse(providerCall("lfaa_browser_click", { providerId: provider.id, role: button.role, name: button.name }, "browser-click"));
        }
        case 11:
          assert.match(lastResult, /点击后 1 次/u);
          return sse(providerCall("lfaa_browser_scroll", { providerId: provider.id, direction: "down", amount: 420 }, "browser-scroll"));
        case 12: {
          assert.match(lastResult, /点击后 1 次/u);
          return sse(providerCall("lfaa_browser_observe", { providerId: provider.id }, "browser-observe-after-scroll"));
        }
        case 13: {
          const observation = JSON.parse(lastResult.slice(lastResult.indexOf("：") + 1));
          assert.match(observation.pageText, /点击后 1 次/u);
          const scrollPosition = Number(observation.pageText.match(/滚动位置：(\d+)/u)?.[1] ?? 0);
          assert.ok(scrollPosition > 0, `实际页面滚动事件应更新可观察状态：${observation.pageText}`);
          return sse({ content: `同一 Agent Run 已从真实隔离页面确认标题“${observation.title}”，根据可访问控件完成点击，并读取滚动位置 ${scrollPosition} 像素。` });
        }
        default:
          throw new Error(`Agent 意外请求了第 ${requests.length} 轮 Provider`);
      }
    } catch (error) {
      providerFailure = error;
      return sse({ content: "隔离 Skill/Browser Provider 夹具发现断言失败。" });
    }
  };

  try {
    const pluginHost = {
      llm: createAiCompletionService(),
      executeLocalProjectFile: input => executeProjectFile(input),
      createLocalProjectPreview: async (nodeId, directory, relativePath) => {
        assert.equal(nodeId, null, "隔离项目不得绑定 Daemon 节点");
        assert.equal(directory, root);
        const preview = await createProjectPreviewServer(directory, relativePath);
        return { url: preview.url, close: async () => { previewCloseCount++; await preview.close(); } };
      },
      listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], listHooks: () => [],
      getSystemInstructions: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] })
    };
    await executeAiTurn({
      userId: owner,
      userRole: "admin",
      body: { appId: "workspace", sessionId: turn.session.id, content: "安装临时 Browser Skill，再用它检查 index.html。" },
      turn,
      aiPluginHost: pluginHost,
      abortController: new AbortController(),
      emit() {},
      modelResolver
    });
    assert.equal(providerFailure, null, providerFailure?.message ?? "");
    assert.equal(requests.length, 13, "同一 Agent Run 完成 Skill 检查、安装、动作发现、导航、观察、可访问点击、滚动和滚动后回读");
    assert.match(sessions.getAiRun(owner, turn.assistantMessage.id).message.content, /滚动位置 \d+ 像素/u);
    assert.match(await readFile(join(root, ".agents", "skills", "browser-check", "SKILL.md"), "utf8"), /LFAA 已登记的浏览器工具/u);
    assert.equal(await readFile(join(root, ".agents", "skills", "browser-check", "scripts", "check.mjs"), "utf8"), "throw new Error('Skill 附属脚本不得被安装流程执行');");
    await assert.rejects(readFile(join(root, "script-ran.txt"), "utf8"), { code: "ENOENT" });
    const events = await sessions.getAiQueryEventsPage(owner, turn.session.id, turn.session.id, { after: 0, limit: 100 });
    for (const name of ["capability_inspect", "capability_install", "lfaa_skill_list", "lfaa_skill_load", "lfaa_browser_open_workspace_file", "lfaa_browser_navigate", "lfaa_browser_observe", "lfaa_browser_click", "lfaa_browser_scroll"]) {
      assert.ok(events.events.some(event => event.type === "tool/call" && event.data.name === name), `缺少 ${name} 的同 Run 调用证据`);
    }
  } finally {
    globalThis.fetch = nativeFetch;
    await manager.closeAll();
    for (const dispose of disposers.splice(0)) dispose();
  }

  assert.equal(previewCloseCount, 1, "Run 完成后预览服务已回收");
});

test("取消 Run 中挂起的真实浏览器导航会回收页面、预览服务和桥接", async t => {
  const manager = new BrowserSessionManager(true);
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available)
    ?? manager.listProviders().find(item => item.id === "lfaa-managed-chrome" && item.available);
  if (!provider) {
    await manager.closeAll();
    return t.skip("当前系统没有可启动的隔离 Edge/Chrome");
  }

  const ownerId = "isolated-browser-cancel-owner";
  const sourceSessionId = randomUUID();
  const controller = new AbortController();
  const sockets = new Set();
  let resolveRequestStarted;
  const requestStarted = new Promise(resolve => { resolveRequestStarted = resolve; });
  const server = createServer((_request, response) => {
    resolveRequestStarted();
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.write("<!doctype html><title>取消验收</title><body>等待响应结束</body>");
  });
  server.on("connection", socket => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previewUrl = `http://127.0.0.1:${address.port}/waiting.html`;
  let previewCloseCount = 0;
  let runCleanup;
  const closePreview = async () => {
    previewCloseCount += 1;
    if (!server.listening) return;
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
  };
  const runAdapter = manager.createRunAdapter({
    ownerId,
    sourceSessionId,
    runId: randomUUID(),
    signal: controller.signal,
    onRunDispose: cleanup => { runCleanup = cleanup; }
  });
  const navigation = runAdapter.navigateProjectPreview(provider.id, { url: previewUrl, close: closePreview });
  t.after(async () => {
    controller.abort();
    runCleanup?.();
    await manager.closeAll();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(() => resolve()));
    }
  });

  let requestTimer;
  await Promise.race([
    requestStarted,
    new Promise((_, reject) => { requestTimer = setTimeout(() => reject(new Error("浏览器没有向挂起页面发起导航请求。")), 10_000); })
  ]).finally(() => clearTimeout(requestTimer));
  assert.ok(await manager.getPanelRevision(ownerId, sourceSessionId, provider.id), "取消前 Browser Owner 已建立当前账户与 Session 的真实页面");

  controller.abort();
  await assert.rejects(navigation, /浏览器操作已取消/u);
  runCleanup?.();
  assert.throws(() => runAdapter.observe(provider.id), /桥接已结束/u);
  assert.equal(await manager.getPanelRevision(ownerId, sourceSessionId, provider.id), null, "取消后不能继续读取已关闭的浏览器页面");
  const cleanupDeadline = Date.now() + 5_000;
  while ((previewCloseCount === 0 || sockets.size > 0) && Date.now() < cleanupDeadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(previewCloseCount, 1, "取消时只回收一次 Run 所有的项目预览服务");
  assert.equal(server.listening, false, "项目预览 HTTP 服务已停止监听");
  assert.equal(sockets.size, 0, "挂起的浏览器 HTTP 连接已关闭");
  await manager.closeAll();
});
