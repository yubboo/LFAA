// 验证 agent 与绑定的导入导出：快照往返、按 id 覆盖、非法内容拒绝、内置 default 不被覆盖。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import {
  AgentProfileService,
  BUILTIN_AGENT_ID,
  DEFAULT_BINDING_ID,
  createAgentProfileHttpHandler,
} from "../src/index";

async function withService(task: (service: AgentProfileService, dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-snapshot-"));
  try {
    await task(new AgentProfileService(new Context(), {
      agentsFilePath: path.join(dir, "agents.json"),
      bindingsFilePath: path.join(dir, "bindings.json"),
    }), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("快照包含内置项，导入后新 agent 与绑定都出现", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({ name: "主力", targets: [{ profileId: "deepseek" }] });
    const agent = await service.createAgent({ name: "审查员", instructions: "只挑问题", bindingId: binding.id });
    const snapshot = await service.exportSnapshot();
    assert.equal(snapshot.version, 1);
    assert.ok(snapshot.agents.some((item) => item.id === BUILTIN_AGENT_ID));
    assert.ok(snapshot.agents.some((item) => item.id === agent.id));
    assert.ok(snapshot.bindings.some((item) => item.id === DEFAULT_BINDING_ID));

    await assert.rejects(service.importSnapshot({ agents: "x" }), /不是有效的 LFAA agent 快照/u);

    await service.removeAgent(agent.id);
    await service.removeBinding(binding.id);
    const stats = await service.importSnapshot(snapshot);
    // 删掉的审查员重新导入是新增，内置小鱼按 id 合并算覆盖。
    assert.equal(stats.agents.added, 1);
    assert.equal(stats.agents.updated, 1);
    assert.ok((await service.listAgents()).some((item) => item.name === "审查员"));
    assert.ok((await service.listBindings()).some((item) => item.name === "主力"));
  });
});

test("按 id 覆盖同名 agent，内置 default 绑定不被导入改写", async () => {
  await withService(async (service) => {
    const agent = await service.createAgent({ name: "旧名" });
    const snapshot = {
      version: 1,
      exportedAt: Date.now(),
      agents: [{ ...agent, name: "新名", source: "builtin" }],
      bindings: [{ id: DEFAULT_BINDING_ID, name: "被改坏的默认", targets: [], strategy: "single", onError: "fail", createdAt: 0, updatedAt: 0 }],
    };
    const stats = await service.importSnapshot(snapshot);
    assert.equal(stats.bindings.updated, 0);
    const updated = await service.getAgent(agent.id);
    assert.equal(updated?.name, "新名");
    // 导入里谎称内置也不能把用户自建 agent 变成内置。
    assert.equal(updated?.source, "user");
    assert.equal((await service.getBinding(DEFAULT_BINDING_ID))?.name, "默认模型");
  });
});

/** 简易请求/响应替身。 */
async function call(handler: ReturnType<typeof createAgentProfileHttpHandler>, method: string, url: string, body?: unknown) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
    },
  });
  let status = 200;
  let raw = "";
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk?: string | Buffer) => {
      status = res.statusCode;
      raw = chunk ? chunk.toString() : "";
    },
  };
  const handled = await handler(req as never, res as never);
  return { handled, status, json: raw ? JSON.parse(raw) as Record<string, unknown> : {} };
}

test("HTTP：导出返回快照，导入回传统计", async () => {
  await withService(async (service) => {
    await service.createAgent({ name: "实现者" });
    const handler = createAgentProfileHttpHandler(service);
    const exported = await call(handler, "GET", "/api/agents/export");
    assert.equal(exported.status, 200);
    const snapshot = exported.json.snapshot as Record<string, unknown>;
    assert.ok(Array.isArray(snapshot.agents));

    const imported = await call(handler, "POST", "/api/agents/import", { snapshot });
    assert.equal(imported.status, 200);
    assert.equal((imported.json.agents as { updated: number }).updated, 2);
  });
});