/** 功能：登记账户与节点认证的交互式终端路由。作用：复用统一权限审批、设置和 SSE，Shell 只在目标 Daemon 执行。关联文件：registry.ts、permission-presets/permissions.ts、host/daemon/terminal-channel.mjs。 */
import type { Router, Request, Response } from "express";
import Joi from "joi";
import { createHash } from "node:crypto";
import { win32 } from "node:path";
import { requireAuthentication, requireRole, resolveSocketSessionFromCookieHeader } from "lfaa-authorization/src/middleware.js";
import { asyncHandler, parseBody, writeSse, requireLocalDaemon, validateDaemonRequest } from "lfaa-api-remotes/src/route-contracts.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import { openSseStream } from "lfaa-api-gateway/src/sse.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { authorizeAiTool, requestAiToolApproval, consumeAiToolApproval } from "lfaa-permission-presets/src/permissions.js";
import { createEmptyAiSession, getAiSession, listAiSessions } from "lfaa-session/src/sessions.js";
import { listDaemonNodes, getDaemonDataRoot } from "lfaa-host-daemon/src/local-daemon.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import type { TerminalRegistry, RegisteredTerminal } from "./registry.js";
import type { TerminalEvent } from "./protocol.js";

const idSchema = Joi.string().guid({ version: "uuidv4" }).required();
const dimensions = { cols: Joi.number().integer().min(2).max(500).default(80), rows: Joi.number().integer().min(1).max(300).default(24) };
const createSchema = Joi.object({ id: idSchema, nodeId: idSchema, appId: Joi.string().valid(...APPLICATION_IDS).required(), sessionId: Joi.string().guid().allow(null), approvalId: Joi.string().guid(), ...dimensions }).unknown(false);
const nodeSchema = Joi.object({ nodeId: idSchema, channelId: idSchema }).unknown(false);
const eventSchema = Joi.object({ nodeId: idSchema, channelId: idSchema, events: Joi.array().items(
  Joi.object({ type: Joi.valid("ack").required(), commandId: idSchema, ok: Joi.boolean().required(), message: Joi.string().max(500) }).unknown(false),
  Joi.object({ type: Joi.valid("output").required(), id: idSchema, data: Joi.string().max(16 * 1024).required() }).unknown(false),
  Joi.object({ type: Joi.valid("exit").required(), id: idSchema, exitCode: Joi.number().integer().allow(null).required(), message: Joi.string().max(500) }).unknown(false)
).min(1).max(16).required() }).unknown(false);
const toolIdentity = { toolId: "lfaa_interactive_terminal", toolVersion: "1", risk: "dangerous" as const };
function policy(userId: string, appId: ApplicationId, scopeKey: string) {
  return { ...toolIdentity, userId, activeApplicationId: appId, toolApplicationIds: [...APPLICATION_IDS], scopeKey, executable: true };
}
function assertSession(terminal: RegisteredTerminal, request: Request, registry: TerminalRegistry): void {
  const settings = getUserSettings(terminal.userId);
  if (request.auth?.sessionId !== terminal.loginSessionId || settings.permissions.mode !== terminal.permissionMode
    || !terminal.approved && authorizeAiTool(policy(terminal.userId, terminal.appId as ApplicationId, terminal.scopeKey)) !== "allow") {
    void registry.close(terminal.userId, terminal.info.id);
    throw new ApiError(403, "terminal_authorization_changed", "登录或权限已变化，请重新创建终端。");
  }
}
function boundedWrite(response: Response, event: string, data: unknown): void {
  if (response.writableLength > 1024 * 1024) { response.destroy(); throw new Error("终端接收端过慢，连接已关闭。"); }
  writeSse(response, event, data);
}

export function registerTerminalRoutes(router: Router, registry: TerminalRegistry, _aiHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {
  const browserAuth = [requireAuthentication, requireRole("admin")];
  router.get("/terminals/nodes", ...browserAuth, (_request, response) => response.json({ nodes: listDaemonNodes().map(node => ({ id: node.id, displayName: node.displayName, connected: registry.connected(node.id) && node.status === "online" })) }));
  router.get("/terminals", ...browserAuth, (request, response) => response.json({ terminals: registry.list(request.auth!.user.id) }));
  router.post("/terminals", ...browserAuth, createRateLimit(12, 60_000), asyncHandler(async (request, response) => {
    const body = parseBody<{ id: string; nodeId: string; appId: ApplicationId; sessionId?: string | null; approvalId?: string; cols: number; rows: number }>(createSchema, request.body);
    const node = listDaemonNodes().find(node => node.id === body.nodeId);
    if (!node || node.status !== "online" || !registry.connected(node.id)) throw new ApiError(409, "terminal_node_offline", "目标节点的交互式终端尚未连接。");
    const userId = request.auth!.user.id, settings = getUserSettings(userId), root = getDaemonDataRoot(node.id);
    if (!root) throw new ApiError(409, "terminal_node_root_missing", "目标节点尚未登记工作目录。");
    const cwd = win32.resolve(root, settings.general.taskFolder || "."), shell = settings.general.integratedShell;
    if (cwd.includes("\0")) throw new ApiError(400, "terminal_cwd_invalid", "设置中的任务目录无效。");
    const scopeKey = `node-terminal:${node.id}:${createHash("sha256").update(JSON.stringify({ cwd, shell })).digest("hex")}`;
    const parameters = { id: body.id, nodeId: node.id, appId: body.appId, cwd, shell };
    let approved = false;
    if (authorizeAiTool(policy(userId, body.appId, scopeKey)) !== "allow") {
      if (body.approvalId) approved = consumeAiToolApproval({ ...toolIdentity, userId, approvalId: body.approvalId, appId: body.appId, scopeKey, parameters });
      if (!approved) {
        let session = body.sessionId ? getAiSession(userId, body.sessionId) : listAiSessions(userId, false, body.appId)[0];
        if (body.sessionId && (!session || session.appId !== body.appId)) throw new ApiError(404, "terminal_session_missing", "找不到此应用下的会话。");
        session ??= createEmptyAiSession(userId, body.appId, "交互式终端审批");
        const approval = requestAiToolApproval({ ...toolIdentity, userId, sessionId: session.id, appId: body.appId, scopeKey, parameters,
          summary: `在 ${node.displayName} 打开交互式终端；批准包括本会话中输入的所有命令，可访问该节点 OS 账户权限范围内的文件和程序。`, scopeSummary: `${node.displayName} · ${shell} · ${cwd}` });
        response.status(202).json({ approval }); return;
      }
    }
    const terminal = await registry.create({ userId, loginSessionId: request.auth!.sessionId, appId: body.appId, permissionMode: settings.permissions.mode, approved, scopeKey },
      { id: body.id, nodeId: node.id, title: `${node.displayName} · ${shell}`, cwd, shell, cols: body.cols, rows: body.rows, state: "starting", exitCode: null });
    response.status(201).json({ terminal });
  }));
  router.get("/terminals/:id/follow", ...browserAuth, (request, response) => {
    const terminal = registry.get(request.auth!.user.id, request.params.id); assertSession(terminal, request, registry);
    const stream = openSseStream(request, response);
    let release = () => {}, timer: ReturnType<typeof setInterval> | undefined, finished = false;
    const output = (data: string) => { try { boundedWrite(response, "output", { data }); } catch { finish(); } };
    const exit = (data: unknown) => { writeSse(response, "exit", data); finish(); };
    const finish = () => {
      if (finished) return; finished = true;
      clearInterval(timer); terminal.events.off("output", output); terminal.events.off("exit", exit);
      response.off("close", finish); release(); stream.close(); response.end();
    };
    release = registry.follow(terminal, finish);
    response.once("close", finish);
    writeSse(response, "ready", { terminal: terminal.info, truncated: terminal.truncated });
    for (const data of terminal.replay) output(data);
    if (terminal.info.state === "exited") { exit({ exitCode: terminal.info.exitCode }); return; }
    terminal.events.on("output", output); terminal.events.on("exit", exit);
    timer = setInterval(() => {
      try {
        const auth = resolveSocketSessionFromCookieHeader(request.headers.cookie);
        if (!auth || auth.expiresAt <= Date.now() || !["admin", "super_admin"].includes(auth.session.user.role)) throw new Error("登录已失效。");
        assertSession(terminal, request, registry);
      } catch { void registry.close(terminal.userId, terminal.info.id); finish(); }
    }, 15_000); timer.unref();
  });
  router.post("/terminals/:id/input", ...browserAuth, asyncHandler(async (request, response) => {
    const body = parseBody<{ data: string }>(Joi.object({ data: Joi.string().min(1).max(16 * 1024).required() }).unknown(false), request.body);
    const terminal = registry.get(request.auth!.user.id, request.params.id); assertSession(terminal, request, registry);
    if (terminal.info.state !== "running") throw new ApiError(409, "terminal_exited", "终端已结束。");
    await registry.command(terminal.info.nodeId, { type: "input", id: terminal.info.id, data: body.data }); response.status(204).end();
  }));
  router.post("/terminals/:id/resize", ...browserAuth, asyncHandler(async (request, response) => {
    const body = parseBody<{ cols: number; rows: number }>(Joi.object(dimensions).unknown(false), request.body);
    const terminal = registry.get(request.auth!.user.id, request.params.id); assertSession(terminal, request, registry);
    await registry.command(terminal.info.nodeId, { type: "resize", id: terminal.info.id, ...body });
    terminal.info = { ...terminal.info, ...body }; response.status(204).end();
  }));
  router.delete("/terminals/:id", ...browserAuth, asyncHandler(async (request, response) => { await registry.close(request.auth!.user.id, request.params.id); response.status(204).end(); }));

  router.post("/daemon/terminals/connect", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; channelId: string }>(nodeSchema, request.body);
    if (registry.connected(body.nodeId)) throw new ApiError(409, "terminal_node_connected", "节点已有终端连接。");
    const stream = openSseStream(request, response);
    const finish = () => { clearInterval(timer); detach(); stream.close(); response.end(); };
    const detach = registry.attachNode(body.nodeId, body.channelId, command => { validateDaemonRequest(request); boundedWrite(response, "command", command); }, finish);
    const timer = setInterval(() => { try { validateDaemonRequest(request); } catch { finish(); } }, 15_000); timer.unref();
    response.once("close", finish); writeSse(response, "ready", { channelId: body.channelId });
  });
  router.post("/daemon/terminals/events", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; channelId: string; events: TerminalEvent[] }>(eventSchema, request.body);
    for (const event of body.events) registry.accept(body.nodeId, body.channelId, event);
    response.status(204).end();
  });
}
