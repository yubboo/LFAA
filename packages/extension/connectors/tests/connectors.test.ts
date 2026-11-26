// 验证 CLI 连接器：工具注册与启停、参数按 argv 传递不经 shell、超时回收、探测与 HTTP 接口。
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import mcpPlugin from "@lfaa/mcp";
import connectorsPlugin, { createConnectorsHttpHandler } from "../src/index";
import { CONNECTOR_CATALOG } from "../src/catalog";
import { runCatalogConnect } from "../src/catalog-runner";
import type { CatalogEntry, CatalogJob } from "../contract";

const ECHO_ACTION = {
  id: "echo_arg",
  title: "回显参数",
  description: "把收到的参数原样打印出来",
  readOnly: true,
  argv: ["-e", "process.stdout.write(process.argv[1] ?? '')", "{{text}}"],
  params: { text: { type: "string", description: "文本", required: true } },
};

const SLEEP_ACTION = {
  id: "sleep",
  title: "长任务",
  description: "一直不退出，用于验证超时回收",
  readOnly: true,
  timeoutMs: 1_200,
  argv: ["-e", "setTimeout(() => {}, 60000)"],
  params: {},
};

async function boot(directory: string) {
  const context = new Context();
  await context.plugin(toolsPlugin, { includeBuiltins: false });
  const mcpFiber = context.plugin(mcpPlugin, { file: join(directory, "mcp-servers.json") });
  await mcpFiber;
  const connectorsFiber = context.plugin(connectorsPlugin, { file: join(directory, "connectors.json") });
  await connectorsFiber;
  return {
    context,
    service: context.connectors,
    dispose: async () => {
      await connectorsFiber.dispose();
      await mcpFiber.dispose();
    },
  };
}

function nodeConnector(extra: Record<string, unknown> = {}) {
  return {
    name: "Node",
    description: "本机 Node",
    executable: process.execPath,
    cwd: "",
    env: {},
    probeArgs: ["--version"],
    actions: [ECHO_ACTION, SLEEP_ACTION],
    ...extra,
  };
}

test("CLI 动作注册为工具，参数按单个 argv 传递而不是经过 shell", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-"));
  const { context, service, dispose } = await boot(directory);
  try {
    await service.save("node", nodeConnector(), true);
    const scope = context.tools.scope(new Set(["@lfaa/connectors"]), false, null);
    const tool = "cli__node__echo_arg";
    assert.equal(scope.getTool(tool)?.permissionLevel, "read");
    assert.equal(scope.getTool(tool)?.approval, "always");
    assert.match(JSON.stringify(scope.getLlmToolSchemas()), /cli__node__echo_arg/u);

    const run = { workspaceRoots: [], sessionId: "test", runId: "test", signal: new AbortController().signal };
    const injected = "hello; echo pwned && rm -rf /";
    const result = await scope.executeTool(tool, { text: injected }, run);
    assert.equal(result.ok, true, result.output);
    // 节点脚本只打印 argv[1]，shell 若参与会把它拆成多条命令。
    assert.equal(result.output.trim(), injected);

    const summary = service.list().find((item) => item.id === "node");
    assert.equal(summary?.kind, "cli");
    assert.equal(summary?.status, "ready");
    assert.equal(summary?.tools.length, 2);
    assert.equal(summary?.actions[0]?.readOnly, true);
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("关闭连接器立即撤销工具，重新启用恢复；信任设置同步到审批级别", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-toggle-"));
  const { context, service, dispose } = await boot(directory);
  try {
    await service.save("node", nodeConnector(), true);
    const scope = context.tools.scope(new Set(["@lfaa/connectors"]), false, null);
    assert.ok(scope.getTool("cli__node__echo_arg"));

    await service.save("node", { enabled: false }, false);
    assert.equal(context.tools.getTool("cli__node__echo_arg"), undefined);
    assert.equal(service.list()[0]?.status, "disabled");

    await service.save("node", { enabled: true, trust: "trusted" }, false);
    assert.equal(context.tools.getTool("cli__node__echo_arg")?.approval, "trusted");

    await service.remove("node");
    assert.equal(context.tools.getTool("cli__node__echo_arg"), undefined);
    assert.deepEqual(service.list(), []);
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("超时终止进程并返回失败原因，危险占位符保存时被拒绝", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-timeout-"));
  const { context, service, dispose } = await boot(directory);
  try {
    await service.save("node", nodeConnector(), true);
    const scope = context.tools.scope(new Set(["@lfaa/connectors"]), false, null);
    const run = { workspaceRoots: [], sessionId: "test", runId: "test", signal: new AbortController().signal };
    const started = Date.now();
    const result = await scope.executeTool("cli__node__sleep", {}, run);
    assert.equal(result.ok, false);
    assert.match(result.output, /超时/u);
    assert.ok(Date.now() - started < 15_000, "超时后进程必须被回收");

    await assert.rejects(
      () => service.save("broken", { ...nodeConnector(), actions: [{ ...ECHO_ACTION, argv: ["-e", "x", "{{missing}}"] }] }, true),
      /unknown parameter/u,
    );
    await assert.rejects(
      () => service.save("broken", { ...nodeConnector(), actions: [{ ...ECHO_ACTION, argv: [{ arg: "--flag", when: "text" }] }] }, true),
      /boolean parameter/u,
    );
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("探测可执行文件并返回版本，缺失命令给出可读错误", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-probe-"));
  const { service, dispose } = await boot(directory);
  try {
    const found = await service.probe(process.execPath);
    assert.ok(found.path);
    assert.match(found.version ?? "", /v\d+/u);
    const missing = await service.probe("lfaa-definitely-missing-binary");
    assert.match(missing.error ?? "", /未找到/u);
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("动作级审批覆盖连接器设置", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-trust-"));
  const { context, service, dispose } = await boot(directory);
  try {
    await service.save("node", nodeConnector({
      trust: "trusted",
      actions: [
        { ...ECHO_ACTION, id: "inherits" },
        { ...ECHO_ACTION, id: "needs_ask", trust: "ask" },
      ],
    }), true);
    assert.equal(context.tools.getTool("cli__node__inherits")?.approval, "trusted");
    assert.equal(context.tools.getTool("cli__node__needs_ask")?.approval, "always");
    const summary = service.list()[0];
    assert.equal(summary?.tools.find((tool) => tool.name === "cli__node__needs_ask")?.trust, "ask");
    assert.equal(summary?.tools.find((tool) => tool.name === "cli__node__inherits")?.trust, "inherit");
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("导入连接器：单个对象与 connectors 数组都接受，导入项停用且重名拒绝", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-import-"));
  const { context, service, dispose } = await boot(directory);
  try {
    await service.import({ connectors: [{ ...nodeConnector(), id: "imported", name: "Imported" }] });
    const imported = service.list().find((item) => item.id === "imported");
    assert.equal(imported?.enabled, false);
    assert.equal(imported?.status, "disabled");
    assert.equal(context.tools.getTool("cli__imported__echo_arg"), undefined);

    await service.import({ ...nodeConnector(), id: "single" });
    assert.ok(service.list().some((item) => item.id === "single"));

    await assert.rejects(() => service.import({ ...nodeConnector(), id: "imported" }), /已存在/u);
    await assert.rejects(
      () => service.import([{ ...nodeConnector(), id: "dup" }, { ...nodeConnector(), id: "dup" }]),
      /重复/u,
    );
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("目录：内置 20+ 条目，初始都未连接", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-catalog-"));
  const { service, dispose } = await boot(directory);
  try {
    assert.ok(CONNECTOR_CATALOG.length >= 20);
    const items = service.catalog();
    assert.equal(items.length, CONNECTOR_CATALOG.length);
    assert.ok(items.some((item) => item.kind === "mcp"));
    assert.ok(items.some((item) => item.kind === "cli"));
    assert.ok(items.every((item) => !item.connected));
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("目录连接任务：CLI 落配置，缺命令且无安装器时报可读错误", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const deps = {
    listMcp: () => [],
    saveMcp: async () => {},
    hasCli: () => false,
    saveCli: async (_id: string, payload: Record<string, unknown>) => { saved.push(payload); },
  };
  const base: Omit<CatalogEntry, "id" | "kind" | "cli" | "mcp"> = {
    name: "Demo", description: "demo", glyph: "🧪", category: "dev", publisher: "test", version: "1", website: "https://example.com", examples: [],
  };
  const entry: CatalogEntry = { ...base, id: "demo", kind: "cli", cli: { executable: basename(process.execPath), actions: [] } };
  const job: CatalogJob = { id: "job-1", entryId: "demo", state: "running", message: "", startedAt: Date.now() };
  await runCatalogConnect(job, entry, {}, deps);
  assert.equal(job.state, "done");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.enabled, true);

  const missing: CatalogEntry = { ...base, id: "missing", kind: "cli", cli: { executable: "lfaa-definitely-missing-binary", actions: [] } };
  const failJob: CatalogJob = { ...job, id: "job-2", entryId: "missing", state: "running" };
  await assert.rejects(() => runCatalogConnect(failJob, missing, {}, deps), /没有可用的安装器/u);
});

test("目录连接任务：MCP 等到 connected 才算完成，error 立即失败，必填输入先校验", async () => {
  let status = "connecting";
  const deps = {
    listMcp: () => [{ id: "demo-mcp", status }],
    saveMcp: async () => {},
    hasCli: () => false,
    saveCli: async () => {},
  };
  const entry = {
    id: "demo-mcp", name: "Demo MCP", description: "", glyph: "🧪", category: "dev", kind: "mcp",
    publisher: "test", version: "1", website: "https://example.com", examples: [],
    mcp: { transport: "stdio", command: "node", args: [] },
    inputs: [{ key: "token", label: "令牌", kind: "password", required: true }],
  } as CatalogEntry;
  const job: CatalogJob = { id: "job-3", entryId: "demo-mcp", state: "running", message: "", startedAt: Date.now() };
  await assert.rejects(() => runCatalogConnect(job, entry, {}, deps), /令牌/u);

  setTimeout(() => { status = "connected"; }, 50);
  await runCatalogConnect(job, entry, { token: "secret" }, deps);
  assert.equal(job.state, "done");

  const failing = { ...deps, listMcp: () => [{ id: "demo-mcp", status: "error" }] };
  const failJob: CatalogJob = { ...job, id: "job-4", state: "running" };
  await assert.rejects(() => runCatalogConnect(failJob, entry, { token: "secret" }, failing), /连接失败/u);
});

test("HTTP 接口：模板新建、修改、测试与删除", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-connectors-http-"));
  const { service, dispose } = await boot(directory);
  const handler = createConnectorsHttpHandler(service);
  const server: Server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api/connectors`;
  const send = (method: string, url: string, body?: unknown) => fetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  try {
    const listed = await (await send("GET", base)).json() as { connectors: unknown[]; templates: Array<{ id: string }>; catalog: Array<{ id: string; kind: string }> };
    assert.deepEqual(listed.connectors, []);
    assert.deepEqual(listed.templates.map((template) => template.id), ["gh", "docker", "pnpm"]);
    assert.ok(listed.catalog.length >= 20);
    assert.equal((await send("GET", `${base}/jobs/missing`)).status, 404);

    const created = await send("POST", base, { templateId: "gh" });
    assert.equal(created.status, 200);
    const afterCreate = await created.json() as { connectors: Array<{ id: string; status: string }> };
    assert.equal(afterCreate.connectors[0]?.id, "gh");
    assert.equal(afterCreate.connectors[0]?.status, "error");

    const patched = await send("PATCH", `${base}/gh`, { executable: process.execPath, actions: [ECHO_ACTION] });
    assert.equal(patched.status, 200);
    const afterPatch = await patched.json() as { connectors: Array<{ id: string; status: string; tools: unknown[] }> };
    assert.equal(afterPatch.connectors[0]?.status, "ready");
    assert.equal(afterPatch.connectors[0]?.tools.length, 1);

    const tested = await send("POST", `${base}/gh/test`).then((response) => response.json()) as { result: { ok: boolean } };
    assert.equal(tested.result.ok, true);

    const removed = await send("DELETE", `${base}/gh`);
    assert.equal(removed.status, 200);
    const afterRemove = await removed.json() as { connectors: unknown[] };
    assert.deepEqual(afterRemove.connectors, []);

    // 导入路由必须先于 /:id 处理，否则会被当成连接器 id。
    const imported = await send("POST", `${base}/import`, { connectors: [{ ...nodeConnector(), id: "imported" }] });
    assert.equal(imported.status, 200);
    const afterImport = await imported.json() as { connectors: Array<{ id: string; enabled: boolean }> };
    assert.equal(afterImport.connectors[0]?.id, "imported");
    assert.equal(afterImport.connectors[0]?.enabled, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});