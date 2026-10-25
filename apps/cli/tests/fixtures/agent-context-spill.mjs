/** 功能：隔离启动 Harness 并验证 Agent Loop 大工具结果溢出和 Run 生命周期回收。 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
process.env.SERVER_PORT = String(reservation.address().port); await new Promise(resolve => reservation.close(resolve));
const isolatedTempRoot = join(process.env.LFAA_DATA_DIR, "isolated-temp");
await mkdir(isolatedTempRoot, { recursive: true });
for (const key of ["TEMP", "TMP", "TMPDIR"]) process.env[key] = isolatedTempRoot;

const { boot } = await import("lfaa-app-boot/src/index.js");
const ctx = await boot(["--profile", "web"]);
try {
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const { createRunSpillContext } = await import("lfaa-agent-loop/src/spill-context-tool.js");
const { createAiPluginHost } = await import("lfaa-app-boot/src/ai-host.js");
const host = createAiPluginHost(ctx);
const owner = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(owner, 87001, "agent-context-spill-fixture");

const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
let callId = 0;
const call = (name, args) => sse({ tool_calls: [{ index: 0, id: `spill-${++callId}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
let providerResponse = () => sse({ content: "fixture final" });
globalThis.fetch = async (url, options) => String(url).endsWith("/models")
  ? Response.json({ data: [{ id: "fixture-spill-model", context_window: 40_000, max_output_tokens: 4096 }] })
  : providerResponse(JSON.parse(options.body), options);

const account = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "spill fixture", modelId: "fixture-spill-model", reasoningMode: "default" });
settings.activateAiAccount(owner, account.id);
settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, autoCompaction: true, contextWindowTokens: 40_000, requestRetries: 0, maxModelRequests: 5, maxToolCalls: 5 });
const storedAccount = configuration.get("ai_accounts", row => row.id === account.id);
const catalog = JSON.parse(storedAccount.models_json).map(model => model.id === account.modelId ? { ...model, contextWindow: 40_000 } : model);
configuration.update("ai_accounts", row => row.id === account.id, { models_json: JSON.stringify(catalog) });

const memory = new Map();
let droppedSession = null;
const memoryStore = {
  async spill({ sessionId, content }) { const location = randomUUID(); memory.set(location, { sessionId, content }); return { backend: "local-file", location, sizeBytes: Buffer.byteLength(content), storedAt: new Date().toISOString() }; },
  async load(reference) { const entry = memory.get(reference.location); if (!entry) throw new Error("missing"); return entry.content; },
  async readRange(reference, { offset, limit }) { const content = await this.load(reference), characters = Array.from(content); return { text: characters.slice(offset, offset + limit).join(""), totalCharacters: characters.length }; },
  async dropSession(sessionId) { droppedSession = sessionId; for (const [location, entry] of memory) if (entry.sessionId === sessionId) memory.delete(location); }
};
const scopedSession = randomUUID(), scopedRun = randomUUID();
const scoped = createRunSpillContext({ store: memoryStore, userId: owner, applicationId: "workspace", sessionId: scopedSession, runId: scopedRun, contextWindow: 4096 });
const scopedRef = await scoped.store.spill({ sessionId: scopedSession, content: "🙂0123456789abcdefghijklmnopqrstuvwxyz" });
const scopedContext = { userId: owner, userRole: "admin", applicationId: "workspace", agentRunId: scopedRun, sessionId: scopedSession, signal: new AbortController().signal, onProgress() {} };
const scopedParameters = scoped.tool.parse({ location: scopedRef.location, offset: 0, limit: 8 });
assert.equal(scoped.tool.risk(scopedParameters, scopedContext), "read");
assert.equal((await scoped.tool.execute(scopedParameters, scopedContext)).text, "🙂0123456", "读取按 Unicode 字符数而不是 UTF-16 码元分页");
await assert.rejects(scoped.tool.execute(scopedParameters, { ...scopedContext, userId: randomUUID() }), /仅允许当前账户/u);
const missingParameters = scoped.tool.parse({ location: randomUUID(), limit: 8 });
await assert.rejects(scoped.tool.execute(missingParameters, scopedContext), /不存在该溢出引用/u);
const foreignSession = randomUUID(), foreignRun = randomUUID();
const foreign = createRunSpillContext({ store: memoryStore, userId: owner, applicationId: "workspace", sessionId: foreignSession, runId: foreignRun, contextWindow: 4096 });
await assert.rejects(foreign.tool.execute(foreign.tool.parse({ location: scopedRef.location, limit: 8 }), { ...scopedContext, sessionId: foreignSession, agentRunId: foreignRun }), /不存在该溢出引用/u);
await foreign.dispose();
await scoped.dispose();
assert.equal(droppedSession, scopedSession, "清理只使用当前 Run 绑定的 Session ID");

const resultPrefix = "spill-only-eligible-prefix:";
const history = [];
for (let index = 0; index < 3; index++) history.push(
  { role: "assistant", content: null, tool_calls: [{ id: `large-result-${index}`, type: "function", function: { name: "fixture_large_result", arguments: "{}" } }] },
  { role: "tool", tool_call_id: `large-result-${index}`, content: `${index === 0 ? resultPrefix : "recent-result:"}${"原始工具结果🙂".repeat(6500)}` }
);
history.push({ role: "user", content: "读取早期工具结果的开头" });

async function spillDirectoryNames() {
  try { return (await readdir(join(isolatedTempRoot, "lfaa-spill"), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

let readRequested = false, readReturned = false, summaryRequests = 0, providerFailure = null;
settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, autoCompaction: false });
let disabledRequestSeen = false;
providerResponse = body => {
  disabledRequestSeen = true;
  if (JSON.stringify(body.messages).includes('"spilled":true')) providerFailure ??= "autoCompaction 关闭后仍发生了溢出。";
  if (body.tools?.some(item => item.function.name === "agent_context_read_spill")) providerFailure ??= "autoCompaction 关闭后仍暴露溢出读取工具。";
  return sse({ content: "spill disabled remains unchanged" });
};
const disabledTurn = sessions.createAiTurn(owner, "workspace", null, "autoCompaction disabled"); disabledTurn.history = history;
await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: disabledTurn.session.id, content: "autoCompaction disabled" }, turn: disabledTurn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });
assert.equal(sessions.getAiRun(owner, disabledTurn.assistantMessage.id)?.status, "complete");
assert.equal(disabledRequestSeen, true); assert.equal(providerFailure, null, providerFailure ?? "");
assert.deepEqual(await spillDirectoryNames(), [], "关闭自动上下文管理时不创建 spill 目录");
settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, autoCompaction: true });

providerResponse = body => {
  if (JSON.stringify(body.messages).includes("你是会话压缩器")) { summaryRequests++; return sse({ content: "unexpected summary" }); }
  if (!readRequested) {
    const marker = body.messages.find(message => message.role === "tool" && typeof message.content === "string" && message.content.includes('"spilled":true'));
    if (!marker) { providerFailure ??= "首个 Provider 请求没有收到 spill 引用。"; return sse({ content: "missing spill marker" }); }
    const reference = JSON.parse(marker.content);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(reference.location)) providerFailure ??= "Provider 收到了非不透明 spill ID。";
    if (/[\\/]|:/u.test(reference.location)) providerFailure ??= "spill 引用泄漏了路径内容。";
    if (!body.tools?.some(item => item.function.name === "agent_context_read_spill")) providerFailure ??= "读取工具未加入触发溢出的当前 Run。";
    readRequested = true;
    return call("agent_context_read_spill", { location: reference.location, offset: 0, limit: 128 });
  }
  const retrieved = body.messages.filter(message => message.role === "tool").at(-1);
  if (!retrieved?.content?.includes(resultPrefix)) providerFailure ??= "按需读取没有返回指定原始内容片段。";
  readReturned = true;
  return sse({ content: "spill read verified" });
};
const successfulTurn = sessions.createAiTurn(owner, "workspace", null, "读取早期工具结果的开头"); successfulTurn.history = history;
const successAbort = new AbortController();
await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: successfulTurn.session.id, content: "读取早期工具结果的开头" }, turn: successfulTurn, aiPluginHost: host, abortController: successAbort, emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });
assert.equal(sessions.getAiRun(owner, successfulTurn.assistantMessage.id)?.status, "complete");
assert.equal(readRequested, true); assert.equal(readReturned, true); assert.equal(summaryRequests, 0); assert.equal(providerFailure, null, providerFailure ?? "");
assert.deepEqual(await spillDirectoryNames(), [], "成功完成后应删除本 Run 的临时 spill 目录");
console.log("verified:agent-context-spill-success");

let failedRequests = 0;
providerFailure = null;
providerResponse = body => {
  failedRequests++;
  if (failedRequests === 1) {
    const marker = body.messages.find(message => message.role === "tool" && typeof message.content === "string" && message.content.includes('"spilled":true'));
    if (!marker) providerFailure = "Provider 错误用例没有先创建 spill 引用。";
    if (!body.tools?.some(item => item.function.name === "agent_context_read_spill")) providerFailure ??= "Provider 错误用例未看到当前 Run 的 spill 读取工具。";
    const reference = marker ? JSON.parse(marker.content) : null;
    return reference ? call("agent_context_read_spill", { location: reference.location, offset: 0, limit: 128 }) : sse({ content: "missing spill marker" });
  }
  return Response.json({ error: { message: "isolated provider failure" } }, { status: 500 });
};
const failedTurn = sessions.createAiTurn(owner, "workspace", null, "Provider 错误时回收溢出"); failedTurn.history = history;
await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: failedTurn.session.id, content: "Provider 错误时回收溢出" }, turn: failedTurn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });
assert.equal(sessions.getAiRun(owner, failedTurn.assistantMessage.id)?.status, "error");
assert.equal(failedRequests, 2); assert.equal(providerFailure, null, providerFailure ?? "");
assert.deepEqual(await spillDirectoryNames(), [], "Provider 错误后应删除本 Run 的临时 spill 目录");
console.log("verified:agent-context-spill-error");

readRequested = false; readReturned = false; providerFailure = null;
let cancelController;
providerResponse = body => {
  if (JSON.stringify(body.messages).includes("你是会话压缩器")) { summaryRequests++; return sse({ content: "unexpected summary" }); }
  if (!readRequested) {
    const marker = body.messages.find(message => message.role === "tool" && typeof message.content === "string" && message.content.includes('"spilled":true'));
    if (!marker) providerFailure ??= "取消 Run 前没有创建 spill 引用。";
    else {
      const reference = JSON.parse(marker.content);
      readRequested = true;
      return call("agent_context_read_spill", { location: reference.location, offset: 0, limit: 128 });
    }
  }
  cancelController.abort(new DOMException("isolated spill cancellation", "AbortError"));
  return sse({ content: "must not complete" });
};
const cancelledTurn = sessions.createAiTurn(owner, "workspace", null, "取消溢出读取"); cancelledTurn.history = history;
cancelController = new AbortController();
await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: cancelledTurn.session.id, content: "取消溢出读取" }, turn: cancelledTurn, aiPluginHost: host, abortController: cancelController, emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });
assert.equal(sessions.getAiRun(owner, cancelledTurn.assistantMessage.id)?.status, "interrupted");
assert.equal(readRequested, true); assert.equal(providerFailure, null, providerFailure ?? "");
assert.deepEqual(await spillDirectoryNames(), [], "取消 Run 后应删除本 Run 的临时 spill 目录");
console.log("verified:agent-context-spill-cancel");

await host.close();
} finally {
  await ctx.fiber.dispose();
}
