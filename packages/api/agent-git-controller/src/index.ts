/**
 * 功能：提供账户隔离、与 Daemon/WorkspaceProject 无关的 Agent 本机 Git 管理 API。
 * 作用：连接 Session Owner、Agent Git Workspace Owner、Permission Owner 与本机 Git Host。
 * 不负责：凭据加密存储（由 Settings Credentials Owner 提供）、Daemon Git 执行或任意 Git 命令。
 */
import { Router } from "express";
import Joi from "joi";
import { createHash } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import { credentialReference, type CredentialConsumer, type CredentialRegistry } from "lfaa-credentials/src/index.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { authorizeExplicitUserAction } from "lfaa-permission-presets/src/permissions.js";
import { executeGitWorkspace, readGitRemoteUrl, resolveGitProjectDirectory, resolveGitWorkspaceDirectory } from "lfaa-host-git";
import { isLocalDaemonIdentity, isRemoteDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { executeProjectFile } from "lfaa-host-project-files/src/project-files.mjs";
import { getAiSession, getAiSessionMessages, getAiSessionWorkspaceContext } from "lfaa-session/src/sessions.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { asyncHandler, parseBody } from "lfaa-api-remotes/src/route-contracts.js";
import { bindAgentGitSessionRepository, getAgentGitRepository, getAgentGitSessionRepository, listAgentGitRepositories, registerAgentGitRepository, removeAgentGitRepository } from "lfaa-workspace-agent-git";
import { getWorkspaceProject, isDefaultWorkspaceProject } from "lfaa-workspace-workspace/src/index.js";

const repositoryPathSchema = Joi.object({ path: Joi.string().trim().min(1).max(32760).required(), title: Joi.string().trim().max(120).allow("") }).unknown(false);
const bindRepositorySchema = Joi.object({ repositoryId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null).required() }).unknown(false);
const repositoryOperationSchema = Joi.object({
  operation: Joi.string().valid("stage", "unstage", "commit", "history", "branches", "branch-create", "branch-switch", "branch-delete", "fetch", "pull", "push", "push-upstream", "remote-add", "remote-remove").required(),
  paths: Joi.array().items(Joi.string().min(1).max(32760).custom((value: string, helpers) => {
    const segments = value.split("/");
    return value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value) || segments.some(segment => !segment || segment === "." || segment === "..")
      ? helpers.error("string.pattern.base") : value;
  })).max(200).unique(),
  message: Joi.string().trim().min(1).max(5000),
  branch: Joi.string().trim().min(1).max(250),
  remote: Joi.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u),
  url: Joi.string().trim().min(1).max(2048),
  username: Joi.string().trim().min(1).max(256).pattern(/^[^:\s\u0000-\u001f\u007f]+$/u),
  token: Joi.string().min(1).max(16384).pattern(/^[^\u0000-\u001f\u007f]+$/u),
  limit: Joi.number().integer().min(1).max(50)
}).custom((value: Record<string, unknown>, helpers) => {
  const operation = value.operation;
  const allowed = operation === "stage" || operation === "unstage" ? ["operation", "paths"]
    : operation === "commit" ? ["operation", "message"]
      : operation === "history" ? ["operation", "limit"]
        : operation === "branches" ? ["operation"]
          : operation === "fetch" ? ["operation", "remote"]
            : operation === "push-upstream" || operation === "remote-remove" ? ["operation", "remote"]
              : operation === "remote-add" ? ["operation", "remote", "url", "username", "token"]
              : ["operation", "branch"];
  if (Object.keys(value).some(key => !allowed.includes(key))) return helpers.error("object.unknown");
  if (operation === "commit" && typeof value.message !== "string") return helpers.error("any.required");
  if (["branch-create", "branch-switch", "branch-delete"].includes(String(operation)) && typeof value.branch !== "string") return helpers.error("any.required");
  if (operation === "push-upstream" && typeof value.remote !== "string") return helpers.error("any.required");
  if (["remote-add", "remote-remove"].includes(String(operation)) && typeof value.remote !== "string") return helpers.error("any.required");
  if (operation === "remote-add" && typeof value.url !== "string") return helpers.error("any.required");
  if (operation === "remote-add" && Boolean(value.username) !== Boolean(value.token)) return helpers.error("object.with");
  return value;
}).unknown(false);
const remoteCredentialSchema = Joi.object({
  username: Joi.string().trim().min(1).max(256).pattern(/^[^:\s\u0000-\u001f\u007f]+$/u).required(),
  token: Joi.string().min(1).max(16384).pattern(/^[^\u0000-\u001f\u007f]+$/u).required()
}).unknown(false);
const repositoryFilePathSchema = Joi.string().trim().min(1).max(32760).custom((value: string, helpers) => {
    const segments = value.split("/");
    return value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value) || segments.some(segment => !segment || segment === "." || segment === "..")
      ? helpers.error("string.pattern.base") : value;
  }).required();

function requireRepository(userId: string, repositoryId: string) {
  const repository = getAgentGitRepository(userId, repositoryId);
  if (!repository) throw new ApiError(404, "agent_git_repository_not_found", "找不到当前账户登记的 Agent Git 仓库。");
  return repository;
}

function requireSession(userId: string, sessionId: string) {
  const session = getAiSession(userId, sessionId);
  if (!session) throw new ApiError(404, "agent_git_session_not_found", "找不到当前账户的 Agent 会话。");
  return session;
}

async function ensureSessionProjectRepository(userId: string, sessionId: string) {
  const existing = getAgentGitSessionRepository(userId, sessionId);
  if (existing) return existing;
  const snapshot = getAiSessionWorkspaceContext(userId, sessionId);
  if (!snapshot) return null;
  const project = getWorkspaceProject(userId, snapshot.id);
  const migratedDefaultProject = project?.nodeId === null && isDefaultWorkspaceProject(userId, snapshot.id) && !isRemoteDaemonIdentity(snapshot.nodeId);
  if (!project || (project.nodeId !== snapshot.nodeId && !migratedDefaultProject) || (project.appId && project.appId !== snapshot.appId) || (project.nodeId !== null && !isLocalDaemonIdentity(project.nodeId))) return null;
  let directory: string;
  try { directory = await resolveGitProjectDirectory(project.path); }
  catch (error) { throw new ApiError(400, "agent_git_project_path_invalid", error instanceof Error ? error.message : "本机会话项目目录不可用。 "); }
  const repository = registerAgentGitRepository({ userId, path: directory, title: project.title });
  if (!bindAgentGitSessionRepository(userId, sessionId, repository.id)) throw new ApiError(409, "agent_git_session_binding_failed", "Agent Git 项目无法绑定到当前会话。 ");
  return repository;
}

function authorizeGitWrite(userId: string, repositoryId: string, operation: string, risk: "write" | "dangerous"): void {
  const authorization = authorizeExplicitUserAction({
    userId,
    activeApplicationId: "workspace",
    toolApplicationIds: ["workspace"],
    toolId: `agent.git.${operation}`,
    toolVersion: "1",
    risk,
    scopeKey: repositoryId,
    executable: true
  });
  if (authorization !== "allow") throw new ApiError(403, "agent_git_operation_not_authorized", "当前权限模式未授权此本机 Git 写操作。");
}

const credentialProviderId = "lfaa-api-agent-git-controller";
type AgentGitStatusSnapshot = { remotes: string[]; upstream: string | null; [key: string]: unknown };

function remoteCredentialReference(repositoryId: string, remote: string, remoteUrl: string) {
  const repositoryKey = repositoryId.replace(/-/gu, "");
  const remoteDigest = createHash("sha256").update(remote).update("\0").update(remoteUrl).digest("hex").slice(0, 40);
  return credentialReference(credentialProviderId, `git-${repositoryKey}-${remoteDigest}`);
}

function isHttpsRemote(url: string): boolean {
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}

async function decorateRemoteCredentialStatus(consumer: CredentialConsumer, userId: string, repository: { id: string; path: string }, status: AgentGitStatusSnapshot) {
  const authenticatedRemotes: string[] = [];
  const credentialCapableRemotes: string[] = [];
  const syncCapableRemotes: string[] = [];
  for (const remote of status.remotes) {
    try {
      const remoteUrl = await readGitRemoteUrl(repository.path, remote);
      if (isHttpsRemote(remoteUrl)) {
        syncCapableRemotes.push(remote);
        credentialCapableRemotes.push(remote);
        const reference = remoteCredentialReference(repository.id, remote, remoteUrl);
        if (consumer.describeRecord(userId, reference)) authenticatedRemotes.push(remote);
      } else if (remoteUrl.startsWith("file://")) {
        syncCapableRemotes.push(remote);
      }
    } catch { /* 无效或外部 remote 不显示凭据状态；Git Host 会拒绝执行。 */ }
  }
  return { ...status, authenticatedRemotes, credentialCapableRemotes, syncCapableRemotes };
}

async function remoteCredentialForOperation(consumer: CredentialConsumer, userId: string, repository: { id: string; path: string }, operation: string, remote?: string) {
  let selectedRemote = remote;
  if (operation === "pull" || operation === "push") {
    const status = await executeGitWorkspace({ operation: "status", projectDirectory: repository.path }) as AgentGitStatusSnapshot;
    const slash = status.upstream?.indexOf("/") ?? -1;
    selectedRemote = slash > 0 ? status.upstream!.slice(0, slash) : undefined;
  } else if (operation === "fetch" && !selectedRemote) {
    const status = await executeGitWorkspace({ operation: "status", projectDirectory: repository.path }) as AgentGitStatusSnapshot;
    selectedRemote = status.remotes.length === 1 ? status.remotes[0] : undefined;
  }
  if (!selectedRemote) return undefined;
  const remoteUrl = await readGitRemoteUrl(repository.path, selectedRemote);
  if (!isHttpsRemote(remoteUrl)) return undefined;
  const reference = remoteCredentialReference(repository.id, selectedRemote, remoteUrl);
  const record = consumer.readRecord(userId, reference);
  if (!record) return undefined;
  if (record.kind !== "api-key" || !record.key || !record.env?.username) throw new ApiError(500, "agent_git_credential_invalid", "此 Git remote 的加密凭据格式无效，请重新配置。 ");
  return { username: record.env.username, token: record.key };
}

export function registerRoutes(router: Router, context: Context, consumer: CredentialConsumer): void {
  router.get("/agent/git/repositories", requireAuthentication, (request, response) => {
    response.json({ repositories: listAgentGitRepositories(request.auth!.user.id) });
  });

  router.post("/agent/git/repositories", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ path: string; title?: string }>(repositoryPathSchema, request.body);
    let path: string;
    try { path = await resolveGitWorkspaceDirectory(body.path); }
    catch (error) { throw new ApiError(400, "agent_git_repository_path_invalid", error instanceof Error ? error.message : "本机 Git 目录无效。"); }
    const repository = registerAgentGitRepository({ userId: request.auth!.user.id, path, ...(body.title !== undefined ? { title: body.title } : {}) });
    response.status(201).json({ repository });
  }));

  router.delete("/agent/git/repositories/:repositoryId", requireAuthentication, (request, response) => {
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    if (!removeAgentGitRepository(userId, request.params.repositoryId)) throw new ApiError(404, "agent_git_repository_not_found", "找不到当前账户登记的 Agent Git 仓库。");
    const prefix = `git-${repository.id.replace(/-/gu, "")}-`;
    for (const metadata of context.lfaaCredentials.listRecords(context, userId)) {
      if (metadata.reference.providerId === credentialProviderId && metadata.reference.id.startsWith(prefix)) context.lfaaCredentials.deleteRecord(context, userId, metadata.reference);
    }
    response.status(204).end();
  });

  router.get("/agent/git/sessions/:sessionId/repository", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    requireSession(userId, request.params.sessionId);
    response.json({ repository: getAgentGitSessionRepository(userId, request.params.sessionId) });
  }));

  router.post("/agent/git/sessions/:sessionId/repository/ensure", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    requireSession(userId, request.params.sessionId);
    const messages = getAiSessionMessages(userId, request.params.sessionId);
    if ((messages ?? []).some(message => message.role === "assistant" && ["queued", "streaming"].includes(message.status))) {
      const activeBinding = getAgentGitSessionRepository(userId, request.params.sessionId);
      if (activeBinding) { response.json({ repository: activeBinding }); return; }
      throw new ApiError(409, "agent_git_session_busy", "Agent 正在工作；项目 Git 会在本轮开始时自动关联。 ");
    }
    response.json({ repository: await ensureSessionProjectRepository(userId, request.params.sessionId) });
  }));

  router.put("/agent/git/sessions/:sessionId/repository", requireAuthentication, (request, response) => {
    const body = parseBody<{ repositoryId: string | null }>(bindRepositorySchema, request.body);
    const userId = request.auth!.user.id;
    requireSession(userId, request.params.sessionId);
    const messages = getAiSessionMessages(userId, request.params.sessionId);
    if ((messages ?? []).some(message => message.role === "assistant" && ["queued", "streaming"].includes(message.status))) {
      throw new ApiError(409, "agent_git_session_busy", "Agent 正在工作，当前不能切换仓库。");
    }
    if (body.repositoryId && !getAgentGitRepository(userId, body.repositoryId)) throw new ApiError(404, "agent_git_repository_not_found", "找不到当前账户登记的 Agent Git 仓库。");
    if (!bindAgentGitSessionRepository(userId, request.params.sessionId, body.repositoryId)) throw new ApiError(409, "agent_git_session_binding_failed", "Agent Git 仓库绑定失败。");
    response.json({ repository: body.repositoryId ? getAgentGitRepository(userId, body.repositoryId) : null });
  });

  router.post("/agent/git/repositories/:repositoryId/status", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    const status = await executeGitWorkspace({ operation: "status", projectDirectory: repository.path }) as AgentGitStatusSnapshot;
    response.json({ status: await decorateRemoteCredentialStatus(consumer, userId, repository, status) });
  }));

  router.put("/agent/git/repositories/:repositoryId/remotes/:remote/credential", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; token: string }>(remoteCredentialSchema, request.body);
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    let remoteUrl: string;
    try { remoteUrl = await readGitRemoteUrl(repository.path, request.params.remote); }
    catch (error) { throw new ApiError(400, "agent_git_remote_invalid", error instanceof Error ? error.message : "Git remote 无效。 "); }
    if (!isHttpsRemote(remoteUrl)) throw new ApiError(400, "agent_git_remote_credentials_unsupported", "账户隔离凭据目前只支持 HTTPS remote；本机 bare remote 不需要凭据，SSH remote 暂不支持同步。 ");
    authorizeGitWrite(userId, repository.id, "remote-credential", "dangerous");
    context.lfaaCredentials.commitRecord(context, userId, remoteCredentialReference(repository.id, request.params.remote, remoteUrl), {
      kind: "api-key", key: body.token, env: { username: body.username }
    });
    response.status(204).end();
  }));

  router.delete("/agent/git/repositories/:repositoryId/remotes/:remote/credential", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    let remoteUrl: string;
    try { remoteUrl = await readGitRemoteUrl(repository.path, request.params.remote); }
    catch (error) { throw new ApiError(400, "agent_git_remote_invalid", error instanceof Error ? error.message : "Git remote 无效。 "); }
    const reference = remoteCredentialReference(repository.id, request.params.remote, remoteUrl);
    authorizeGitWrite(userId, repository.id, "remote-credential-remove", "dangerous");
    context.lfaaCredentials.deleteRecord(context, userId, reference);
    response.status(204).end();
  }));

  router.post("/agent/git/repositories/:repositoryId/file-diff", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ path: string; ignoreWhitespace?: boolean; wordDiff?: boolean; contextLines?: number }>(Joi.object({ path: repositoryFilePathSchema, ignoreWhitespace: Joi.boolean(), wordDiff: Joi.boolean(), contextLines: Joi.number().integer().min(0).max(1000) }).unknown(false), request.body);
    const repository = requireRepository(request.auth!.user.id, request.params.repositoryId);
    response.json({ diff: await executeGitWorkspace({ operation: "file-diff", projectDirectory: repository.path, path: body.path, ignoreWhitespace: body.ignoreWhitespace, wordDiff: body.wordDiff, contextLines: body.contextLines }) });
  }));

  router.post("/agent/git/repositories/:repositoryId/file", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ operation: "read" | "write"; path: string; offset?: number; limit?: number; content?: string; sha256?: string }>(Joi.object({
      operation: Joi.string().valid("read", "write").required(), path: repositoryFilePathSchema,
      offset: Joi.number().integer().min(0).max(2 * 1024 * 1024), limit: Joi.number().integer().min(1).max(100000),
      content: Joi.string().max(2 * 1024 * 1024), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u)
    }).unknown(false), request.body);
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    if (body.operation === "write") {
      if (typeof body.content !== "string" || !body.sha256) throw new ApiError(400, "agent_git_file_write_invalid", "保存文件需要内容和最近读取的 SHA-256 摘要。 ");
      authorizeGitWrite(userId, repository.id, "file-write", "write");
    }
    response.json({ file: await executeProjectFile({ operation: body.operation, rootDirectory: repository.path, path: body.path, ...(body.offset === undefined ? {} : { offset: body.offset }), ...(body.limit === undefined ? {} : { limit: body.limit }), ...(body.content === undefined ? {} : { content: body.content }), ...(body.sha256 === undefined ? {} : { sha256: body.sha256 }) }) });
  }));

  router.post("/agent/git/repositories/:repositoryId/initialize", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    authorizeGitWrite(userId, repository.id, "initialize", "dangerous");
    response.status(201).json({ status: await executeGitWorkspace({ operation: "initialize", projectDirectory: repository.path }) });
  }));

  router.post("/agent/git/repositories/:repositoryId/operation", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ operation: string; paths?: string[]; message?: string; branch?: string; remote?: string; url?: string; username?: string; token?: string; limit?: number }>(repositoryOperationSchema, request.body);
    const userId = request.auth!.user.id;
    const repository = requireRepository(userId, request.params.repositoryId);
    const readOnly = body.operation === "history" || body.operation === "branches";
    const risk = ["commit", "branch-delete", "branch-switch", "pull", "push", "push-upstream", "remote-remove"].includes(body.operation)
      || body.operation === "remote-add" && Boolean(body.token) ? "dangerous" : "write";
    if (!readOnly) authorizeGitWrite(userId, repository.id, body.operation, risk);
    let branch = body.branch;
    if (body.operation === "branch-create" && branch) {
      const prefix = getUserSettings(userId).git.branchPrefix;
      if (!branch.startsWith(prefix)) branch = `${prefix}${branch}`;
    }
    const credentialToRemove = body.operation === "remote-remove" && body.remote
      ? await readGitRemoteUrl(repository.path, body.remote).then((url: string) => remoteCredentialReference(repository.id, body.remote!, url)).catch(() => null)
      : null;
    if (body.operation === "remote-add" && body.token && body.url && !isHttpsRemote(body.url)) {
      throw new ApiError(400, "agent_git_remote_credentials_unsupported", "账户隔离凭据目前只支持 HTTPS remote；本机 bare remote 不需要凭据，SSH remote 暂不支持同步。 ");
    }
    const remoteCredential = ["fetch", "pull", "push", "push-upstream"].includes(body.operation)
      ? await remoteCredentialForOperation(consumer, userId, repository, body.operation, body.remote)
      : undefined;
    const result = await executeGitWorkspace({
      operation: body.operation,
      projectDirectory: repository.path,
      ...(body.paths ? { paths: body.paths } : {}), ...(body.message ? { message: body.message } : {}),
      ...(branch ? { branch } : {}), ...(body.remote ? { remote: body.remote } : {}), ...(body.url ? { url: body.url } : {}), ...(body.limit ? { limit: body.limit } : {}),
      ...(remoteCredential ? { remoteCredential } : {})
    });
    if (body.operation === "remote-add" && body.username && body.token && body.remote && body.url) {
      try {
        const currentUrl = await readGitRemoteUrl(repository.path, body.remote);
        if (!isHttpsRemote(currentUrl)) throw new Error("远端地址不是 HTTPS。 ");
        const reference = remoteCredentialReference(repository.id, body.remote, currentUrl);
        context.lfaaCredentials.commitRecord(context, userId, reference, { kind: "api-key", key: body.token, env: { username: body.username } });
      } catch {
        await executeGitWorkspace({ operation: "remote-remove", projectDirectory: repository.path, remote: body.remote }).catch(() => undefined);
        throw new ApiError(500, "agent_git_credential_save_failed", "远端已回滚；账户隔离凭据保存失败，请检查凭据存储状态后重试。 ");
      }
    }
    if (credentialToRemove) context.lfaaCredentials.deleteRecord(context, userId, credentialToRemove);
    if (readOnly) response.json(result);
    else response.json({ status: ["status", "stage", "unstage", "commit", "branch-create", "branch-switch", "branch-delete", "fetch", "pull", "push", "push-upstream", "remote-add", "remote-remove"].includes(body.operation)
      ? await decorateRemoteCredentialStatus(consumer, userId, repository, result as AgentGitStatusSnapshot)
      : result });
  }));
}

export const name = "lfaaApiAgentGitController";
export const inject = ["apiGateway", "lfaaCredentials"];
declare module "@deepseek-ai/cordis" { interface Context { lfaaCredentials: CredentialRegistry } }
export function apply(ctx: Context): void {
  const consumer = ctx.lfaaCredentials.createConsumer(ctx);
  const unregisterCredentialOwner = ctx.lfaaCredentials.registerRecordOwner(ctx, ["lfaa-api-agent-git-controller"]);
  ctx.apiGateway.register(ctx, "agent-git-controller", router => registerRoutes(router, ctx, consumer));
  ctx.effect(() => () => unregisterCredentialOwner());
}
