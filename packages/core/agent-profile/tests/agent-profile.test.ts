// 验证 agent 定义与模型绑定的持久化往返、内置项保护、校验拒绝与默认回落。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Context } from "@deepseek-ai/cordis";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AgentProfileService,
  BUILTIN_AGENT_ID,
  DEFAULT_BINDING_ID,
  resolveBindingIdFor,
  sanitizeAgents,
  sanitizeBindings,
} from "../src/index";

/** 每个用例独立的临时目录与两个配置文件。 */
async function withService(task: (service: AgentProfileService, dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-agent-profile-"));
  try {
    const service = new AgentProfileService(new Context(), {
      agentsFilePath: join(dir, "agents.json"),
      bindingsFilePath: join(dir, "bindings.json"),
    });
    await task(service, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("首次读取补回内置小鱼与默认绑定，并落盘", async () => {
  await withService(async (service, dir) => {
    const agents = await service.listAgents();
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.id, BUILTIN_AGENT_ID);
    assert.equal(agents[0]?.source, "builtin");
    assert.equal(agents[0]?.kind, "assistant");

    const bindings = await service.listBindings();
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0]?.id, DEFAULT_BINDING_ID);
    assert.equal(bindings[0]?.inheritGlobal, true);
    assert.deepEqual(bindings[0]?.targets, []);

    const raw = JSON.parse(await readFile(join(dir, "agents.json"), "utf8")) as { agents: unknown[] };
    assert.equal(raw.agents.length, 1);
  });
});

test("新建 agent 可往返读取，重建实例后仍在", async () => {
  await withService(async (service, dir) => {
    const created = await service.createAgent({ name: "代码审查员", kind: "worker", instructions: "只挑问题，不改代码。" });
    assert.equal(created.source, "user");
    assert.equal(created.enabled, true);

    const second = new AgentProfileService(new Context(), {
      agentsFilePath: join(dir, "agents.json"),
      bindingsFilePath: join(dir, "bindings.json"),
    });
    const listed = await second.listAgents();
    assert.equal(listed.length, 2);
    assert.equal(listed.find((agent) => agent.id === created.id)?.instructions, "只挑问题，不改代码。");
  });
});

test("非法名称、非法 id、重复 id 与不存在的绑定都被拒绝", async () => {
  await withService(async (service) => {
    await assert.rejects(service.createAgent({ name: "   " }), /名称不能为空/u);
    await assert.rejects(service.createAgent({ name: "A", id: "Bad Id" }), /agent id/u);
    await assert.rejects(service.createAgent({ name: "A", bindingId: "missing" }), /绑定不存在/u);
    await assert.rejects(service.createAgent({ name: "A", id: BUILTIN_AGENT_ID }), /已存在/u);
  });
});

test("清空指令与绑定后字段真正消失，而不是留空串", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({ name: "主力", targets: [{ profileId: "deepseek" }] });
    const agent = await service.createAgent({ name: "实现者", instructions: "先看再改。", bindingId: binding.id });
    const cleared = await service.updateAgent(agent.id, { instructions: "", bindingId: "" });
    assert.equal(cleared.instructions, undefined);
    assert.equal(cleared.bindingId, undefined);
    assert.equal("instructions" in cleared, false);
    assert.equal("bindingId" in cleared, false);
  });
});

test("内置小鱼不可删，但可以改名与停用", async () => {
  await withService(async (service) => {
    await assert.rejects(service.removeAgent(BUILTIN_AGENT_ID), /不能删除/u);
    const renamed = await service.updateAgent(BUILTIN_AGENT_ID, { name: "小鲵", enabled: false });
    assert.equal(renamed.name, "小鲵");
    assert.equal(renamed.enabled, false);
    assert.equal(renamed.source, "builtin");
    assert.equal(await service.removeAgent("nobody"), false);
  });
});

test("绑定校验：空目标、单策略多目标、default id、default 改写都被拒绝", async () => {
  await withService(async (service) => {
    await assert.rejects(service.createBinding({ name: "空", targets: [] }), /至少需要一个目标/u);
    await assert.rejects(
      service.createBinding({ name: "多", strategy: "single", targets: [{ profileId: "a" }, { profileId: "b" }] }),
      /只能有一个目标/u,
    );
    await assert.rejects(
      service.createBinding({ name: "占位", id: DEFAULT_BINDING_ID, targets: [{ profileId: "a" }] }),
      /内置绑定 id/u,
    );
    await assert.rejects(service.updateBinding(DEFAULT_BINDING_ID, { name: "改" }), /不能修改/u);
    await assert.rejects(service.removeBinding(DEFAULT_BINDING_ID), /不能删除/u);
  });
});

test("被 agent 引用的绑定不能删除，错误文案列出占用者", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({
      name: "Opus 优先",
      strategy: "order",
      targets: [{ profileId: "anthropic", modelId: "opus" }, { profileId: "kimi" }],
    });
    const agent = await service.createAgent({ name: "审查员", bindingId: binding.id });
    await assert.rejects(service.removeBinding(binding.id), new RegExp(`审查员`, "u"));
    await service.updateAgent(agent.id, { bindingId: "" });
    assert.equal(await service.removeBinding(binding.id), true);
  });
});

test("改策略时目标必须收敛：多目标切 single 被拒绝，显式收敛后通过", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({
      name: "两个",
      strategy: "order",
      targets: [{ profileId: "a" }, { profileId: "b" }],
    });
    await assert.rejects(service.updateBinding(binding.id, { strategy: "single" }), /只能有一个目标/u);
    const narrowed = await service.updateBinding(binding.id, { strategy: "single", targets: [{ profileId: "a" }] });
    assert.equal(narrowed.strategy, "single");
    assert.equal(narrowed.targets.length, 1);
  });
});

test("冷却时长：0 表示清除，负数与非法值拒绝", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({ name: "B", targets: [{ profileId: "a" }], cooldownMs: 5_000 });
    assert.equal(binding.cooldownMs, 5_000);
    const cleared = await service.updateBinding(binding.id, { cooldownMs: 0 });
    assert.equal(cleared.cooldownMs, undefined);
    await assert.rejects(service.updateBinding(binding.id, { cooldownMs: -1 }), /非负/u);
  });
});

test("配置文件损坏时回落到内置项，不抛错", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-agent-profile-"));
  try {
    await writeFile(join(dir, "agents.json"), "{ 不是 JSON", "utf8");
    await writeFile(join(dir, "bindings.json"), JSON.stringify({ version: 1, bindings: "x" }), "utf8");
    const service = new AgentProfileService(new Context(), {
      agentsFilePath: join(dir, "agents.json"),
      bindingsFilePath: join(dir, "bindings.json"),
    });
    assert.equal((await service.listAgents())[0]?.id, BUILTIN_AGENT_ID);
    assert.equal((await service.listBindings())[0]?.id, DEFAULT_BINDING_ID);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("落盘数据归一：坏项丢弃、重复 id 去重、内置项身份不被伪造", async () => {
  const agents = sanitizeAgents({
    agents: [
      { id: BUILTIN_AGENT_ID, name: "小鱼", source: "user", kind: "weird" },
      { id: "dup", name: "A" },
      { id: "dup", name: "B" },
      { id: "", name: "无名" },
      { id: "noName", name: "   " },
    ],
  });
  assert.deepEqual(agents.map((agent) => agent.id), [BUILTIN_AGENT_ID, "dup"]);
  assert.equal(agents[0]?.source, "builtin");
  assert.equal(agents[1]?.name, "A");

  const bindings = sanitizeBindings({
    bindings: [
      { id: "b1", name: "B", strategy: "无此策略", targets: [{ profileId: " a " }, { profileId: "" }] },
      { id: DEFAULT_BINDING_ID, name: "默认模型", inheritGlobal: false },
    ],
  });
  assert.equal(bindings.length, 2);
  assert.equal(bindings.find((binding) => binding.id === "b1")?.strategy, "single");
  assert.deepEqual(bindings.find((binding) => binding.id === "b1")?.targets, [{ profileId: "a" }]);
  assert.equal(bindings.find((binding) => binding.id === DEFAULT_BINDING_ID)?.inheritGlobal, true);
});

test("绑定解析优先级：会话覆盖 > agent 绑定 > 内置默认", async () => {
  await withService(async (service) => {
    const binding = await service.createBinding({ name: "B", targets: [{ profileId: "a" }] });
    const agent = await service.createAgent({ name: "A", bindingId: binding.id });

    assert.equal(await service.resolveBindingId(agent.id), binding.id);
    assert.equal(await service.resolveBindingId(agent.id, "session-override"), "session-override");
    assert.equal(await service.resolveBindingId(BUILTIN_AGENT_ID), DEFAULT_BINDING_ID);
    assert.equal(await service.resolveBindingId(undefined), DEFAULT_BINDING_ID);
    assert.equal(resolveBindingIdFor({ bindingId: "  " }, "  "), DEFAULT_BINDING_ID);
  });
});
test("工具策略随 agent 保存与清空，并能被运行期读到", async () => {
  await withService(async (service, dir) => {
    const created = await service.createAgent({
      name: "只读审查员",
      toolPolicy: { deny: ["run_command", "write_file", " write_file ", ""] },
    });
    // 去重与去空白在写入时完成。
    assert.deepEqual(created.toolPolicy?.deny, ["run_command", "write_file"]);

    const reopened = new AgentProfileService(new Context(), {
      agentsFilePath: join(dir, "agents.json"),
      bindingsFilePath: join(dir, "bindings.json"),
    });
    assert.deepEqual((await reopened.getAgent(created.id))?.toolPolicy?.deny, ["run_command", "write_file"]);

    const cleared = await reopened.updateAgent(created.id, { toolPolicy: null as never });
    assert.equal(cleared.toolPolicy, undefined);

    const updated = await reopened.updateAgent(created.id, { toolPolicy: { deny: ["edit_file"] } });
    assert.deepEqual(updated.toolPolicy?.deny, ["edit_file"]);
  });
});
