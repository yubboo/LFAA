/**
 * 功能：回归领域内容按需加载与工具发现的真实装配边界。
 * 作用：隔离注册表、账户和合成 Provider，不操作真实实例或桌面。
 * 关联文件：system-prompt、agent 扩展注册表、prompt/prompt、skill/minecraft、领域工具插件、Agent Loop。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";
isolateData(test, "package-owner-lazy-capabilities");
const { Context } = await import("@deepseek-ai/cordis");
const { composeLfaaSystemPrompt } = await import("lfaa-system-prompt");
const { AiExtensionRegistry } = await import("lfaa-agent");

test("普通模型请求只带上下文和发现指引，不随 App 自动注入领域总控全文", () => {
  for (const applicationId of ["workspace", "minecraft", "writing"]) {
    const text = composeLfaaSystemPrompt({ applicationId, permissionMode: "full_access", extensions: [] });
    assert.doesNotMatch(text, /你是 LFAA 的 Minecraft 专用 Agent|新开服优先一次调用 minecraft_provision_server|目标明确但没有指定插入位置时默认追加/);
    assert.match(text, /按需/);
  }
});

test("专家和领域提示词不能被扩展目录自动注入，正文由明确加载返回", async () => {
  const ctx = new Context();
  const registry = new AiExtensionRegistry(ctx);
  const fiber = await ctx.plugin({ name: "fixture-instruction", apply(owner) { registry.register(owner, { id: "expert.fixture", pluginId: "fixture", kind: "expert", name: "隔离专家", version: "1.0.0", description: "只供按需选择", instructions: "仅在明确选择后读取的领域方法" }); } });
  assert.deepEqual(registry.getInstructions("minecraft"), []);
  assert.equal(registry.list("expert")[0].instructions, undefined);
  const loaded = await registry.loadInstructions("expert.fixture", "workspace");
  assert.equal(loaded.instructions, "仅在明确选择后读取的领域方法");
  await fiber.dispose();
  await assert.rejects(registry.loadInstructions("expert.fixture", "workspace"), /未登记/);
});

test("真实装配从其他 App 按需发现 Minecraft 方法，完整合同只进入模型选中的 Run", async t => {
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
  const settings = await import("lfaa-settings/src/service.js");
  const sessions = await import("lfaa-session/src/sessions.js");
  retireLegacyFileTables();
  const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
  const { createAiCompletionService } = await import("lfaa-llm/src/completion.js");
  const userId = randomUUID();
  database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture','fixture','admin')").run(userId, `fixture-${userId}`);
  settings.saveUserSettings(userId, "permissions", { mode: "full_access" });
  settings.saveUserSettings(userId, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0 });
  const ctx = new Context(), fibers = [];
  const native = globalThis.fetch;
  try {
    // 提供真实 Owner 函数用于隔离合同验证；完整 Profile 另验实际服务 Fiber。
    for (const [service, source] of [["lfaaMinecraft", "lfaa-games-minecraft/src/service.js"], ["lfaaSteamcmd", "lfaa-games-steamcmd/src/service.js"], ["lfaaWriting", "lfaa-document-writing/src/service.js"]]) ctx.provide(service, await import(source));
    ctx.provide("lfaaRuntimeManager", (await import("lfaa-runtime-manager/src/service.js")).runtimeManager);
    for (const name of ["lfaa-agent", "lfaa-tools", "lfaa-skill", "lfaa-prompt-minecraft", "lfaa-prompt-writing", "lfaa-domain-experts", "lfaa-skill-minecraft", "lfaa-skill-writing", "lfaa-skill-rea", "lfaa-prompt", "lfaa-tool-skill", "lfaa-tool-minecraft", "lfaa-tool-steamcmd", "lfaa-tool-runtime", "lfaa-tool-writing"]) { const plugin = await import(name); fibers.push(await ctx.plugin(plugin.apply ? plugin : plugin.default)); }
    const context = { userId, userRole: "admin", applicationId: "writing", agentRunId: randomUUID(), signal: new AbortController().signal, onProgress() {} };
    const promptTools = (await import("lfaa-prompt")).createInstructionTools(ctx.aiExtensions);
    assert.ok(ctx.aiExtensions.list("prompt").some(entry => entry.id === "prompt.capability-honesty"), "保留原核心 Prompt 稳定 ID");
    assert.ok(ctx.aiExtensions.list("skill").some(entry => entry.id === "skill.application-context"), "保留原核心 Skill 稳定 ID");
    const registeredSkillExtensions = ctx.aiExtensions.list("skill");
    const registrySkills = await ctx.skills.list({ allowHostFilesystem: false });
    assert.equal(registeredSkillExtensions.length, 7, "插件工作区和设置中心共用相同的七条已登记 Skill 能力");
    assert.deepEqual(
      registeredSkillExtensions.map(entry => entry.skillId).sort(),
      registrySkills.map(entry => entry.name).sort(),
      "每条 Skill 能力的 skillId 都指向同一 Skill Registry 条目"
    );
    const list = promptTools.find(tool => tool.name === "lfaa_prompt_list");
    const metadata = await list.execute(list.parse({ query: "minecraft" }), context);
    assert.ok(metadata.entries.some(entry => entry.id === "prompt.minecraft.minecraft-server-controller"));
    assert.ok(metadata.entries.every(entry => entry.instructions === undefined && entry.loadInstructions === undefined));
    const experts = promptTools.find(tool => tool.name === "lfaa_expert_list");
    const expertCatalog = await experts.execute(experts.parse({ query: "Minecraft" }), context);
    const minecraftEmployee = expertCatalog.entries.find(entry => entry.id === "expert.minecraft-hosting");
    assert.ok(minecraftEmployee, "保留原 Minecraft 专家稳定 ID 并允许跨 App 发现");
    assert.equal(minecraftEmployee.name, "Minecraft 应用维护员工");
    const minecraftInstructions = await ctx.aiExtensions.loadInstructions(minecraftEmployee.id, "writing");
    assert.match(minecraftInstructions.instructions, /LFAA Minecraft App 的问题调查、源码维护/u);
    assert.match(minecraftInstructions.instructions, /浏览器或某个下载网站不可访问时/u);
    assert.match(minecraftInstructions.instructions, /lfaa_delegate_subagent/u);
    assert.match(minecraftInstructions.instructions, /保留用户指定的核心、版本与模组\/插件目标/u);
    const skill = (await ctx.skills.list({ allowHostFilesystem: false })).find(entry => entry.name === "minecraft-server-setup");
    assert.equal(skill.provider, "lfaa-minecraft");
    assert.equal(skill.content, undefined);
    assert.match((await ctx.skills.get(skill.name, { allowHostFilesystem: false })).content, /minecraft_provision_server/);
    const reaSkill = (await ctx.skills.list({ allowHostFilesystem: false })).find(entry => entry.name === "reverse-engineer-anything");
    assert.equal(reaSkill.provider, "lfaa-rea");
    assert.equal(reaSkill.content, undefined, "REA 工作流正文在模型选择前不进入目录");
    assert.match((await ctx.skills.get(reaSkill.name, { allowHostFilesystem: false })).content, /Evidence ID/u);

    const requests = [];
    const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    const call = (name, args) => sse({ tool_calls: [{ index: 0, id: `call-${requests.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      const names = body.tools.map(tool => tool.function.name);
      if (requests.length === 1) {
        assert.ok(names.includes("lfaa_tools_load"));
        assert.ok(!names.includes("minecraft_list_instances"));
        assert.ok(!names.includes("minecraft_provision_server"));
        assert.ok(!JSON.stringify(body.messages).includes("你是 LFAA 的 Minecraft 专用 Agent"));
        assert.ok(JSON.stringify(body.messages).includes("skill.registry/minecraft-server-setup"));
        assert.ok(!JSON.stringify(body.messages).includes("新开服优先使用 `minecraft_provision_server`"), "关联不会加载 Skill 正文");
        return call("lfaa_tools_load", { names: ["minecraft_list_instances"] });
      }
      assert.ok(names.includes("minecraft_list_instances"));
      assert.ok(!names.includes("minecraft_provision_server"), "只加载选择的一项，不批量展开全部领域工具");
      if (requests.length === 2) return call("lfaa_prompt_load", { id: "prompt.minecraft.minecraft-server-controller" });
      if (requests.length === 3) {
        assert.ok(JSON.stringify(body.messages).includes("你是 LFAA 的 Minecraft 专用 Agent"));
        return call("minecraft_list_instances", {});
      }
      return sse({ content: "原领域服务返回真实空列表，未创建实例。" });
    };
    const host = { llm: createAiCompletionService(), listPlugins: () => [], listExtensions: kind => ctx.aiExtensions.list(kind), listInstructionExtensions: app => ctx.aiExtensions.listInstructionExtensions(app), listHooks: () => [], getSystemInstructions: app => ctx.aiExtensions.getInstructions(app), loadInstruction: (id, app) => ctx.aiExtensions.loadInstructions(id, app), runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] }) };
    const account = { providerId: "openai", modelId: "fixture", chatUrl: "https://provider.example.test/chat", secret: "invalid-fixture-key", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens", reasoningMode: "default" };
    const turn = sessions.createAiTurn(userId, "workspace", null, "核对 Minecraft 实例", false, null, { applicationIds: ["minecraft"], capabilityIds: ["skill.registry/minecraft-server-setup"] });
    await executeAiTurn({ userId, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content: "核对 Minecraft 实例" }, turn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: { resolve: () => account }, memoryEligible: false });
    const run = sessions.getAiRun(userId, turn.assistantMessage.id);
    assert.equal(run.status, "complete", JSON.stringify(run));
    assert.equal(requests.length, 4);
    assert.deepEqual(JSON.parse(requests[3].messages.filter(message => message.role === "tool").at(-1).content), []);
    const initialSystem = requests[0].messages.find(message => message.role === "system").content;
    const loadedPrompt = JSON.parse(requests[2].messages.filter(message => message.role === "tool").at(-1).content).instructions;
    t.diagnostic(`合成请求工作量：初始系统消息 ${Buffer.byteLength(initialSystem, "utf8")} 字节；按需正文 ${Buffer.byteLength(loadedPrompt, "utf8")} 字节；Minecraft 完整合同从 0 项变为选中的 1 项，未选择的部署合同始终为 0 项。`);

    // 另一界面选择写作上下文时，目标由同一账户 Owner 返回，模型不能注入作品 ID。
    const writing = await import("lfaa-document-writing/src/service.js");
    const book = writing.createWritingBook(userId, "跨界面隔离作品");
    writing.updateWritingBookOutline(userId, book.activeBookId, "BODY-ONLY-AFTER-WRITING-CONTEXT");
    const writingRequests = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); writingRequests.push(body);
      const names = body.tools.map(tool => tool.function.name);
      if (writingRequests.length === 1) {
        assert.ok(!names.includes("writing_list_book_chapters"));
        assert.ok(!JSON.stringify(body.messages).includes("跨界面隔离作品"), "未选择时不预读另一个领域作品正文");
        return call("lfaa_tools_load", { names: ["writing_get_context"] });
      }
      if (writingRequests.length === 2) return call("writing_get_context", {});
      if (writingRequests.length === 3) {
        const evidence = JSON.parse(body.messages.filter(message => message.role === "tool").at(-1).content);
        assert.equal(evidence.context.bookId, book.activeBookId);
        assert.equal(evidence.context.outline, "BODY-ONLY-AFTER-WRITING-CONTEXT");
        return call("lfaa_tools_load", { names: ["writing_list_book_chapters"] });
      }
      if (writingRequests.length === 4) {
        assert.ok(names.includes("writing_list_book_chapters"));
        return call("writing_list_book_chapters", {});
      }
      return sse({ content: "跨界面读取仍绑定当前账户作品。" });
    };
    const writingTurn = sessions.createAiTurn(userId, "minecraft", null, "查看已选作品的章节");
    await executeAiTurn({ userId, userRole: "admin", body: { appId: "minecraft", sessionId: writingTurn.session.id, content: "查看已选作品的章节" }, turn: writingTurn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: { resolve: () => account }, memoryEligible: false });
    assert.equal(sessions.getAiRun(userId, writingTurn.assistantMessage.id).status, "complete");
    assert.equal(writingRequests.length, 5);
    const contextReader = ctx.lfaaTools.listAiBusinessTools("writing", "admin", null, "full_access", true).find(tool => tool.name === "writing_get_context");
    assert.throws(() => contextReader.parse({ bookId: randomUUID() }), /not allowed/);
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.ok(JSON.stringify(body.messages).includes(book.activeBookId), "写作界面保留真实选中目标元数据");
      assert.ok(!JSON.stringify(body.messages).includes("BODY-ONLY-AFTER-WRITING-CONTEXT"), "即使处于写作界面也不自动读取/注入正文");
      return sse({ content: "简单写作问答无需加载正文。" });
    };
    const ordinaryWriting = sessions.createAiTurn(userId, "writing", null, "解释一个术语");
    await executeAiTurn({ userId, userRole: "admin", body: { appId: "writing", sessionId: ordinaryWriting.session.id, content: "解释一个术语" }, turn: ordinaryWriting, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: { resolve: () => account }, memoryEligible: false });
    assert.equal(sessions.getAiRun(userId, ordinaryWriting.assistantMessage.id).status, "complete");

    // 工具发现不能绕过卸载：同一注册表中撤销后，旧精确名称即被拒绝。
    const { createToolDiscoveryTools } = await import("lfaa-tools/src/discovery-tools.js");
    let available = ctx.lfaaTools.listAiBusinessTools("workspace", "admin", null, "full_access", true);
    const discovery = createToolDiscoveryTools(() => available, () => {});
    available = available.filter(tool => tool.name !== "minecraft_list_instances");
    await assert.rejects(discovery[1].execute(discovery[1].parse({ names: ["minecraft_list_instances"] }), context), /不存在、已卸载/);
  } finally {
    globalThis.fetch = native;
    for (const fiber of fibers.reverse()) await fiber.dispose();
  }
});
