/**
 * 功能：覆盖 Agent 自主发现、加载、预览并操作当前工作区 HTML 的完整隔离链路。
 * 作用：使用合成 Provider 和临时账户/目录驱动真实 Browser Owner，不访问真实账户或项目。
 * 关联文件：agent-loop、browser-use、project-files、Permission Owner。
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
const { registerAiBusinessTool } = await import("lfaa-tools/src/registry.js");
const { BrowserSessionManager } = await import("lfaa-browser-use");
const { createBrowserTools } = await import("lfaa-browser-use/src/browser-tools.js");
const { createProjectPreviewServer } = await import("lfaa-host-project-files/src/project-files.mjs");

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
