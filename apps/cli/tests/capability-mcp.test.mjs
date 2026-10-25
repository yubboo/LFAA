/**
 * 功能：回归 MCP 端点经通用能力工具进入账户设置并由实际 Runtime 消费。
 * 作用：验证来源摘要固定、目标 App 隔离、扩展开关尊重和 MCP 工具合同变更 fail closed。
 * 关联文件：packages/boot/capability-mcp/src/index.ts、packages/core/tools/src/mcp-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { isolateData } from "./isolated-data.mjs";
isolateData(test, "capability-mcp");
const { CapabilityInstallRegistry } = await import("lfaa-capability-installs/src/index.js");
const { createMcpCapabilityAdapter } = await import("lfaa-capability-mcp/src/index.js");
await import("lfaa-session/src/sessions.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const { closeMcpConnections, discoverMcpTools } = await import("lfaa-mcp-client/src/runtime.js");
const { getUserSettings, saveUserSettings } = await import("lfaa-settings/src/service.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
for (const [id, uid] of [["user-1", 1], ["user-2", 2]]) {
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(id, uid, id);
}

function settings(enabled = true) {
  return { plugins: { enabled, mcpServers: [] }, aiRuntime: { requestTimeoutSeconds: 5 } };
}

function makeContext(userId = "user-1", applicationId = "workspace") {
  return { userId, userRole: "member", applicationId, signal: new AbortController().signal, onProgress() {} };
}

test("MCP 来源经真实协议检查后安装到单一 App，并由同一 Runtime 核对工具清单", async () => {
  let remoteTools = [{ name: "read_status", description: "读取当前状态", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
  const calls = [];
  let initializeCount = 0;
  let deleteCount = 0;
  const server = createServer(async (request, response) => {
    if (request.method === "DELETE") { deleteCount += 1; response.writeHead(204).end(); return; }
    let bodyText = "";
    for await (const chunk of request) bodyText += chunk;
    const body = JSON.parse(bodyText);
    calls.push(body.method);
    const send = result => {
      response.writeHead(200, { "Content-Type": "application/json", ...(body.method === "initialize" ? { "MCP-Session-Id": "fixture-session" } : {}) });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    };
    if (body.method === "initialize") { initializeCount += 1; send({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }); return; }
    if (body.method === "notifications/initialized") { response.writeHead(202).end(); return; }
    if (body.method === "tools/list") { send({ tools: remoteTools }); return; }
    if (body.method === "tools/call") { send({ content: [{ type: "text", text: "真实 MCP 工具调用结果" }], isError: false }); return; }
    response.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/mcp";
  const users = new Map([["user-1", settings(true)], ["user-2", settings(true)]]);
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, createMcpCapabilityAdapter({
    fetchRegistry: async () => new Response(JSON.stringify({ servers: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    getSettings: userId => users.get(userId) ?? settings(),
    saveSettings(userId, category, value) {
      assert.equal(category, "plugins");
      const current = users.get(userId) ?? settings();
      const next = structuredClone(value);
      users.set(userId, { ...current, plugins: next });
      saveUserSettings(userId, category, next);
    }
  }));
  const context = makeContext();
  try {
    const stdioSearch = await registry.search("mcp", "npx -y @example/mcp-server", "workspace", context);
    assert.deepEqual(stdioSearch.candidates, [], "当前没有 stdio 命令来源目录，不得臆造可安装候选");
    await assert.rejects(registry.inspect("mcp", "npx -y @example/mcp-server", undefined, "workspace", { name: "测试 stdio" }, context), /不是有效 URL/u);
    assert.equal(calls.length, 0, "拒绝 stdio 检查不能启动命令或连接来源");
    assert.deepEqual(users.get("user-1").plugins.mcpServers, []);

    const search = await registry.search("mcp", url, "workspace", context);
    assert.equal(search.candidates[0].source, url);
    assert.equal(search.candidates[0].requiresInspection, true);
    const inspected = await registry.inspect("mcp", url, undefined, "workspace", { name: "测试服务" }, context);
    assert.match(inspected.resolvedRef, /^tools-sha256:[a-f0-9]{64}$/u);
    assert.equal(inspected.details.mcp.toolCount, 1);
    assert.equal(inspected.details.mcp.remoteImplementationPinned, false);
    assert.equal(calls.includes("tools/call"), false, "来源检查不得执行 MCP 工具");

    const installed = await registry.install("mcp", inspected.inspectionId, "workspace", "user-1", context);
    assert.equal(installed.outcome, "verified_ready");
    assert.equal(installed.verification.details.runtimeEnabled, true);
    const entry = getUserSettings("user-1").plugins.mcpServers[0];
    assert.equal(entry.enabled, true);
    assert.deepEqual(entry.applicationIds, ["workspace"]);
    assert.equal(entry.manifestSha256, inspected.details.mcp.manifestSha256);
    assert.deepEqual(users.get("user-2").plugins.mcpServers, [], "安装只写当前用户的设置");

    const runtime = await discoverMcpTools(getUserSettings("user-1").plugins.mcpServers, "workspace", "user-1", new AbortController().signal, 5);
    const toolContext = { ...context, userRole: "admin", signal: new AbortController().signal };
    let installedTool;
    try {
      assert.equal(runtime.errors.length, 0);
      assert.equal(runtime.tools.length, 1);
      assert.equal(runtime.serverStates[0].status, "ready");
      assert.equal(runtime.serverStates[0].manifestSha256, entry.manifestSha256);
      assert.equal(getUserSettings("user-1").plugins.enabled, true, "Runtime 必须读取已写入 Settings Owner 的全局扩展开关");
      assert.deepEqual(getUserSettings("user-1").plugins.mcpServers[0], entry, "Runtime 必须消费 Settings Owner 的规范化记录");
      installedTool = runtime.tools[0];
      assert.equal(installedTool.risk({}), "dangerous");
      const result = await installedTool.execute(installedTool.parse({}), toolContext);
      assert.equal(result.content[0].text, "真实 MCP 工具调用结果");
      assert.equal(calls.filter(method => method === "tools/call").length, 1);
    } finally { await runtime.close(); }

    const writingContext = makeContext("user-1", "writing");
    const otherAppInspection = await registry.inspect("mcp", url, undefined, "writing", { name: "测试服务" }, writingContext);
    await assert.rejects(
      registry.install("mcp", otherAppInspection.inspectionId, "writing", "user-1", writingContext),
      /不会覆盖或扩大既有设置/u
    );
    assert.deepEqual(entry.applicationIds, ["workspace"], "重复来源不得扩大到另一个 App");

    remoteTools = [{ name: "read_status", description: "变化后的说明", inputSchema: { type: "object", properties: { detail: { type: "boolean" } }, additionalProperties: false } }];
    const drifted = await discoverMcpTools(users.get("user-1").plugins.mcpServers, "workspace", "user-1", new AbortController().signal, 5);
    try {
      assert.equal(drifted.tools.length, 0, "远端工具合同变化后不能把工具交给模型");
      assert.equal(drifted.serverStates[0].status, "incompatible");
      assert.match(drifted.errors[0], /SHA-256 不一致/u);
    } finally { await drifted.close(); }

    remoteTools = [{ name: "read_status", description: "读取当前状态", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
    users.get("user-1").plugins.enabled = false;
    const relabeledInspection = await registry.inspect("mcp", url, inspected.resolvedRef, "workspace", { name: "测试服务" }, context);
    const gated = await registry.install("mcp", relabeledInspection.inspectionId, "workspace", "user-1", context);
    assert.equal(gated.outcome, "verified_installed");
    assert.equal(gated.verification.status, "installed");
    assert.match(gated.nextAction, /运行时门当前关闭/u, "扩展开关关闭时必须给出真实阻塞与下一步，而不是重放安装");
    assert.equal(users.get("user-1").plugins.enabled, false, "安装不能替用户打开全局扩展开关");

    const disabled = await registry.setEnabled("mcp", entry.id, false, "workspace", {}, context);
    assert.equal(disabled.enabled, false);
    assert.equal(users.get("user-1").plugins.mcpServers[0].enabled, false);
    assert.equal(getUserSettings("user-1").plugins.mcpServers[0].enabled, false, "停用写入必须经 Settings Owner 并被 Runtime 回读");
    await assert.rejects(installedTool.execute(installedTool.parse({}), toolContext), /停用/u);
    assert.equal(calls.filter(method => method === "tools/call").length, 1, "停用后已加载的旧 Tool 不得再次派发");
    const afterDisable = await discoverMcpTools(getUserSettings("user-1").plugins.mcpServers, "workspace", "user-1", new AbortController().signal, 5);
    try { assert.equal(afterDisable.tools.length, 0); }
    finally { await afterDisable.close(); }

    const removed = await registry.remove("mcp", entry.id, "workspace", {}, context);
    assert.equal(removed.removedApplicationId, "workspace");
    assert.deepEqual(users.get("user-1").plugins.mcpServers, []);
    assert.deepEqual(getUserSettings("user-1").plugins.mcpServers, []);
  } finally {
    await closeMcpConnections();
    assert.equal(deleteCount, initializeCount, "所有真实 MCP Runtime 会话都必须在回归结束前关闭");
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("用户提供的本机 stdio MCP 经 Settings Owner 安装、真实调用、停用和移除", async () => {
  const current = getUserSettings("user-1");
  saveUserSettings("user-1", "plugins", { ...current.plugins, enabled: true, mcpServers: [] });
  const fixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-capability-fixture.mjs", import.meta.url));
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, createMcpCapabilityAdapter());
  const target = { name: "隔离 stdio 测试服务", transport: "stdio", command: process.execPath, args: [fixturePath] };
  let runtime;
  let childPid;
  try {
    const inspected = await registry.inspect("mcp", "stdio://local", undefined, "workspace", target, makeContext());
    assert.match(inspected.resolvedRef, /^tools-sha256:[a-f0-9]{64}$/u);
    assert.equal(inspected.details.mcp.transport, "stdio");
    assert.equal(inspected.details.mcp.command, process.execPath);
    assert.deepEqual(inspected.details.mcp.args, [fixturePath]);

    const installed = await registry.install("mcp", inspected.inspectionId, "workspace", "user-1", makeContext());
    assert.equal(installed.outcome, "verified_ready");
    const entry = getUserSettings("user-1").plugins.mcpServers[0];
    assert.equal(entry.transport, "stdio");
    assert.equal(entry.command, process.execPath);
    assert.deepEqual(entry.args, [fixturePath]);
    assert.equal(entry.computerUse, false);
    assert.deepEqual(entry.applicationIds, ["workspace"]);
    assert.deepEqual(getUserSettings("user-2").plugins.mcpServers, [], "stdio 安装只写当前账户");

    runtime = await discoverMcpTools(getUserSettings("user-1").plugins.mcpServers, "workspace", "user-1", new AbortController().signal, 5);
    assert.equal(runtime.errors.length, 0);
    assert.equal(runtime.tools.length, 1);
    childPid = Number(/PID=(\d+)/u.exec(runtime.instructions[0]?.instructions ?? "")?.[1]);
    assert.ok(Number.isInteger(childPid) && childPid > 0, "测试 MCP 真实子进程必须由 Runtime 握手返回");
    const tool = runtime.tools[0];
    const toolContext = { ...makeContext(), userRole: "admin" };
    const result = await tool.execute(tool.parse({}), toolContext);
    assert.equal(result.content[0].text, "stdio 安装生命周期真实调用结果");

    const disabled = await registry.setEnabled("mcp", entry.id, false, "workspace", {}, makeContext());
    assert.equal(disabled.enabled, false);
    assert.equal(getUserSettings("user-1").plugins.mcpServers[0].enabled, false);
    await assert.rejects(tool.execute(tool.parse({}), toolContext), /停用/u);
    const afterDisable = await discoverMcpTools(getUserSettings("user-1").plugins.mcpServers, "workspace", "user-1", new AbortController().signal, 5);
    try { assert.equal(afterDisable.tools.length, 0); }
    finally { await afterDisable.close(); }

    const removed = await registry.remove("mcp", entry.id, "workspace", {}, makeContext());
    assert.equal(removed.removedApplicationId, "workspace");
    assert.deepEqual(getUserSettings("user-1").plugins.mcpServers, []);
  } finally {
    await runtime?.close();
    await closeMcpConnections();
  }
  assert.throws(() => process.kill(childPid, 0), error => error.code === "ESRCH", "stdio MCP 子进程在最后租约结束后退出");
});

async function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
}

async function waitForProcessExit(pid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await processAlive(pid))) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

test("stdio MCP 最后租约结束后回收 runner 启动的整个进程树", { timeout: 20_000 }, async () => {
  const current = getUserSettings("user-1");
  saveUserSettings("user-1", "plugins", { ...current.plugins, enabled: true, mcpServers: [] });
  const fixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-tree-fixture.mjs", import.meta.url));
  const server = { id: "tree-probe", name: "进程树测试服务", transport: "stdio", command: process.execPath, args: [fixturePath], enabled: true, applicationIds: ["workspace"], computerUse: false };
  let runtime;
  let grandchildPid;
  try {
    runtime = await discoverMcpTools([server], "workspace", "user-1", new AbortController().signal, 5);
    assert.equal(runtime.errors.length, 0);
    assert.equal(runtime.tools.length, 1);
    grandchildPid = Number(/GRANDCHILD_PID=(\d+)/u.exec(runtime.instructions[0]?.instructions ?? "")?.[1]);
    assert.ok(Number.isInteger(grandchildPid) && grandchildPid > 0, "包管理器 runner 启动的真实服务孙进程必须可追踪");
    assert.equal(await processAlive(grandchildPid), true);
    await runtime.close();
    runtime = undefined;
    await closeMcpConnections();
    assert.equal(await waitForProcessExit(grandchildPid), true, "最后租约结束后 runner 与真正的服务孙进程都必须退出");
  } finally {
    await runtime?.close();
    await closeMcpConnections();
    if (grandchildPid && await processAlive(grandchildPid)) {
      try { process.kill(grandchildPid); } catch { /* 隔离测试清理 */ }
    }
  }
});

test("MCP 普通环境设置只传给目标进程并计入配置身份", async () => {
  const fixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-capability-fixture.mjs", import.meta.url));
  const server = {
    id: "fixture-env", name: "隔离环境测试服务", transport: "stdio", command: process.execPath, args: [fixturePath],
    env: { LFAA_MCP_TEST_ENV: "owner-value" }, enabled: true, applicationIds: ["workspace"], computerUse: false
  };
  const { pluginsSettingsSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
  assert.equal(pluginsSettingsSchema.validate({ enabled: true, mcpServers: [server] }).error, undefined, "普通 MCP 环境配置通过 Settings schema");
  assert.ok(pluginsSettingsSchema.validate({ enabled: true, mcpServers: [{ ...server, env: { SERVICE_TOKEN: "secret" } }] }).error, "秘密字段名在 API 校验中失败关闭");
  saveUserSettings("user-1", "plugins", { enabled: true, mcpServers: [server], prompts: [], skillDirectories: [], disabledSkillNames: [] });
  const persisted = getUserSettings("user-1").plugins.mcpServers[0];
  assert.deepEqual(persisted.env, server.env, "Settings Owner 回读真实环境配置");
  const runtime = await discoverMcpTools([persisted], "workspace", "user-1", new AbortController().signal, 5);
  try {
    assert.equal(runtime.errors.length, 0);
    assert.match(runtime.instructions[0].instructions, /TEST_ENV=owner-value/u, "stdio Owner 只向目标 MCP 子进程传入显式配置");
    const changed = { ...persisted, env: { LFAA_MCP_TEST_ENV: "different-value" } };
    const second = await discoverMcpTools([changed], "workspace", "user-1", new AbortController().signal, 5);
    try { assert.notEqual(runtime.serverStates[0].manifestSha256, second.serverStates[0].manifestSha256, "环境配置参与隔离与权限指纹"); }
    finally { await second.close(); }
  } finally { await runtime.close(); }
});

test("stdio MCP 安装期间取消会阻止设置写入并回收 Runtime 子进程", async () => {
  const current = getUserSettings("user-1");
  saveUserSettings("user-1", "plugins", { ...current.plugins, enabled: true, mcpServers: [] });
  const fixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-capability-fixture.mjs", import.meta.url));
  const controller = new AbortController();
  const nativeDiscover = discoverMcpTools;
  let discoverCalls = 0;
  let settingsWrites = 0;
  let childPid;
  const adapter = createMcpCapabilityAdapter({
    async discover(...args) {
      const result = await nativeDiscover(...args);
      discoverCalls += 1;
      if (discoverCalls === 2) {
        childPid = Number(/PID=(\d+)/u.exec(result.instructions[0]?.instructions ?? "")?.[1]);
        assert.ok(Number.isInteger(childPid) && childPid > 0, "安装检查后实际启动的隔离 MCP 子进程可追踪");
        controller.abort(new DOMException("用户取消本次 MCP 安装", "AbortError"));
      }
      return result;
    },
    saveSettings(userId, category, value) {
      settingsWrites += 1;
      saveUserSettings(userId, category, value);
    }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const context = { ...makeContext(), signal: controller.signal };
  try {
    const target = { name: "取消安装隔离服务", transport: "stdio", command: process.execPath, args: [fixturePath] };
    const inspected = await registry.inspect("mcp", "stdio://local", undefined, "workspace", target, context);
    assert.equal(discoverCalls, 1);
    await assert.rejects(registry.install("mcp", inspected.inspectionId, "workspace", "user-1", context), /用户取消本次 MCP 安装/u);
    assert.equal(controller.signal.aborted, true);
    assert.equal(settingsWrites, 0, "Run 取消后安装适配器不得调用 Settings Owner 写入");
    assert.deepEqual(getUserSettings("user-1").plugins.mcpServers, [], "已取消安装不能留下 MCP 服务记录");
    await assert.rejects(registry.install("mcp", inspected.inspectionId, "workspace", "user-1", { ...context, signal: new AbortController().signal }), /不存在、已过期/u, "不确定的取消结果不能重放一次性检查凭证");
  } finally {
    await closeMcpConnections();
  }
  assert.throws(() => process.kill(childPid, 0), error => error.code === "ESRCH", "取消后 Runtime 的最后 stdio 租约会回收隔离子进程");
});

test("官方 MCP Registry 按自然语言发现固定 npm 版本并拒绝秘密输入", async () => {
  const registryServer = {
    name: 'io.example/hello', version: '1.2.3', title: 'Hello MCP', description: '测试服务',
    packages: [{
      registryType: 'npm', identifier: '@example/hello-mcp', version: '1.2.3',
      transport: { type: 'stdio' }, runtimeArguments: [],
      packageArguments: [{ type: 'positional', value: '--stdio' }],
      environmentVariables: [{ name: 'LOG_LEVEL', isRequired: true }]
    }]
  };
  const fetchRegistry = async url => new Response(JSON.stringify(
    url.includes('/versions/') ? { server: registryServer } : { servers: [{ server: registryServer }] }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } });
  let inspectedEnvironment;
  const adapter = createMcpCapabilityAdapter({
    fetchRegistry,
    getSettings: () => settings(true),
    async discover(servers) {
      inspectedEnvironment = servers[0].env;
      return {
        errors: [],
        serverStates: [{ serverId: servers[0].id, status: 'ready', toolCount: 1, protocolVersion: '2025-11-25', manifestSha256: 'a'.repeat(64) }],
        tools: [{ name: 'hello', description: '问候', schema: { type: 'object', properties: {}, additionalProperties: false } }],
        async close() {}
      };
    }
  });
  const context = makeContext();
  const discovered = await adapter.search('hello greeting', 'workspace', context);
  assert.equal(discovered.catalog, 'official-mcp-registry-v0.1');
  const candidate = discovered.candidates.find(item => item.transport === 'stdio');
  assert.ok(candidate?.requiresInspection);
  const target = adapter.validateTarget({ inputs: { LOG_LEVEL: 'debug' } }, 'workspace', context);
  const inspected = await adapter.inspect(candidate.source, undefined, 'workspace', target, context);
  assert.equal(inspected.resolvedTarget.name, 'Hello MCP');
  assert.equal(inspected.details.mcp.packageType, 'npm');
  assert.equal(inspected.details.mcp.packageIdentifier, '@example/hello-mcp');
  assert.ok(inspected.details.mcp.args.some(argument => argument === '@example/hello-mcp@1.2.3'), 'Runtime 必须使用固定 npm 版本');
  assert.ok(inspected.details.mcp.args.includes('--stdio'));
  assert.equal(inspectedEnvironment.LOG_LEVEL, 'debug');
  assert.match(inspectedEnvironment.npm_config_cache, /[\\/]cache[\\/]mcp[\\/]npm$/u, 'npm 缓存位于 LFAA 管理的数据目录');

  registryServer.packages[0].environmentVariables = [{ name: 'SERVICE_TOKEN', isRequired: true, isSecret: true }];
  await assert.rejects(adapter.inspect(candidate.source, undefined, 'workspace', target, context), /秘密环境变量|秘密参数/u);
});
