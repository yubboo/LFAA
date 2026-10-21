import { WORKSPACE_PROJECT_APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
/**
 * 功能：提供账户隔离的项目目录、节点浏览与 Git Worktree API。
 * 作用：在真实 Daemon 上浏览、校验目录并登记项目，登记删除只解除目录关联。
 * 不负责：全局数据文件管理、Minecraft 实例、模型权限模式或直接访问控制端文件系统。
 * 关联文件：packages/workspace/workspace/src/index.ts、packages/host/project-files/src/project-files.mjs、packages/core/session/src/sessions.ts。
 */
import { Router } from "express";
import Joi from "joi";
import { randomUUID } from "node:crypto";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import { authorizeExplicitUserAction } from "lfaa-permission-presets/src/permissions.js";
import { listDaemonNodes, type DaemonNode } from "lfaa-host-daemon/src/local-daemon.js";
import { isLocalDaemonIdentity, isRemoteDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { executeGitWorkspace } from "lfaa-host-git";
import { createAiHostTask, getAiHostTask } from "lfaa-jobs/src/ai-host-tasks.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { asyncHandler, parseBody } from "lfaa-api-remotes/src/route-contracts.js";
import { createAiSessionBranchWithMemory } from "lfaa-agent-loop/src/runs.js";
import { getAiSession, listAiSessions, setAiSessionProject, type AiSessionProjectContext } from "lfaa-session/src/sessions.js";
import { claimWorkspaceProjectApplication, createWorkspaceGitWorktree, createWorkspaceProject, getDefaultWorkspaceProjectId, getWorkspaceProject, hasWorkspaceGitWorktrees, listWorkspaceProjects, searchWorkspaceProjects, removeWorkspaceProject, renameWorkspaceProject, setDefaultWorkspaceProject, updateDefaultWorkspaceProjectPath, type WorkspaceProjectApplicationId } from "lfaa-workspace-workspace/src/index.js";

const projectAppIdSchema = Joi.string().valid(...WORKSPACE_PROJECT_APPLICATION_IDS).required();
const limitAiBranchMemory = createRateLimit(12, 60 * 1000);
const forkWorktreeSchema = Joi.object({ appId: projectAppIdSchema, messageId: Joi.string().guid({ version: ["uuidv4"] }).required(), targetProjectId: Joi.string().guid({ version: ["uuidv4"] }).required() }).unknown(false);
const browseSchema = Joi.object({
  appId: projectAppIdSchema,
  nodeId: Joi.string().guid().required(),
  operation: Joi.string().valid("home", "list", "create-directory").required(),
  path: Joi.string().max(32760).allow("").default(""),
  name: Joi.string().trim().min(1).max(120).when("operation", { is: "create-directory", then: Joi.required(), otherwise: Joi.forbidden() })
}).unknown(false);
const createProjectSchema = Joi.object({ appId: projectAppIdSchema, nodeId: Joi.string().guid().required(), path: Joi.string().max(32760).required(), title: Joi.string().trim().max(120).allow("") }).unknown(false);
const renameProjectSchema = Joi.object({ appId: projectAppIdSchema, title: Joi.string().trim().min(1).max(120).required() }).unknown(false);
const changeSessionProjectSchema = Joi.object({ appId: projectAppIdSchema, projectId: Joi.string().guid().allow(null).required() }).unknown(false);
const removeProjectSchema = Joi.object({ appId: projectAppIdSchema, deleteManagedWorktree: Joi.boolean().default(false) }).unknown(false);
const projectActionSchema = Joi.object({ appId: projectAppIdSchema }).unknown(false);
const createWorktreeSchema = Joi.object({ appId: projectAppIdSchema }).unknown(false);
const projectRelativeFilePathSchema = Joi.string().min(1).max(32760).custom((value: string, helpers) => {
  const segments = value.split("/");
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value) || segments.some((segment: string) => !segment || segment === "." || segment === "..")) return helpers.error("string.pattern.base");
  return value;
}).messages({ "string.pattern.base": "项目文件必须使用安全的项目相对路径。 " });
const gitWorkspaceOperationSchema = Joi.object({
  appId: projectAppIdSchema,
  operation: Joi.string().valid("stage", "unstage", "commit", "history", "branches", "branch-create", "branch-switch", "branch-delete").required(),
  paths: Joi.array().items(projectRelativeFilePathSchema).max(200).unique(),
  message: Joi.string().trim().min(1).max(5000),
  branch: Joi.string().trim().min(1).max(250),
  limit: Joi.number().integer().min(1).max(50)
}).custom((value: Record<string, unknown>, helpers) => {
  const operation = value.operation;
  const allowed = operation === "stage" || operation === "unstage" ? ["appId", "operation", "paths"]
    : operation === "commit" ? ["appId", "operation", "message"]
      : operation === "history" ? ["appId", "operation", "limit"]
        : operation === "branches" ? ["appId", "operation"]
          : ["appId", "operation", "branch"];
  if (Object.keys(value).some(key => !allowed.includes(key))) return helpers.error("object.unknown");
  if (operation === "commit" && typeof value.message !== "string") return helpers.error("any.required");
  if (["branch-create", "branch-switch", "branch-delete"].includes(String(operation)) && typeof value.branch !== "string") return helpers.error("any.required");
  return value;
}).unknown(false);
const projectFileReadSchema = Joi.object({ appId: projectAppIdSchema, path: projectRelativeFilePathSchema.required(), offset: Joi.number().integer().min(0).max(2 * 1024 * 1024).default(0), limit: Joi.number().integer().min(1).max(100000).default(40000) }).unknown(false);
const projectFileWriteSchema = Joi.object({ appId: projectAppIdSchema, path: projectRelativeFilePathSchema.required(), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u).required(), content: Joi.string().max(2 * 1024 * 1024).required() }).unknown(false);
const gitFileDiffSchema = Joi.object({ appId: projectAppIdSchema, path: projectRelativeFilePathSchema.required(), ignoreWhitespace: Joi.boolean().default(false), wordDiff: Joi.boolean().default(false) }).unknown(false);
const projectsQuerySchema = Joi.object({ appId: Joi.string().valid(...WORKSPACE_PROJECT_APPLICATION_IDS).optional(), query: Joi.string().trim().max(200).allow("") }).unknown(false);

function projectHasOtherAppSessions(userId: string, projectId: string, appId: WorkspaceProjectApplicationId): boolean {
  return [false, true].some(archived => listAiSessions(userId, archived).some(session => session.projectId === projectId && session.appId !== appId));
}

function filterLegacyProjectsForApp(userId: string, appId: WorkspaceProjectApplicationId, projects: ReturnType<typeof searchWorkspaceProjects>["projects"]) {
  if (!projects.some(project => project.appId === null)) return projects.filter(project => project.appId === appId);
  const foreignProjectIds = new Set<string>();
  for (const archived of [false, true]) {
    for (const session of listAiSessions(userId, archived)) {
      if (session.projectId && session.appId !== appId) foreignProjectIds.add(session.projectId);
    }
  }
  return projects.filter(project => project.appId === appId || project.appId === null && !foreignProjectIds.has(project.id));
}

type WorkspaceProjectForApp = NonNullable<ReturnType<typeof getWorkspaceProject>> & { appId: WorkspaceProjectApplicationId };

function requireProjectForApp(userId: string, projectId: string, appId: WorkspaceProjectApplicationId): WorkspaceProjectForApp {
  let project = getWorkspaceProject(userId, projectId, appId === "workspace" ? undefined : appId);
  if (project && appId === "workspace") {
    if (project.appId === null) project = claimWorkspaceProjectApplication(userId, projectId, "workspace");
    return project as WorkspaceProjectForApp;
  }
  if (!project) throw new ApiError(404, "workspace_project_not_found", "找不到当前应用下的此项目目录。 ");
  if (project.appId === appId) return project as WorkspaceProjectForApp;
  if (projectHasOtherAppSessions(userId, project.id, appId)) {
    throw new ApiError(409, "workspace_project_legacy_app_conflict", "此旧项目已关联其他应用的会话。请在当前应用重新登记该文件夹，避免跨 App 共享项目。 ");
  }
  const claimed = claimWorkspaceProjectApplication(userId, projectId, appId);
  if (!claimed || claimed.appId !== appId) throw new ApiError(409, "workspace_project_app_claim_failed", "此项目已归属其他应用，不能在当前应用使用。 ");
  return claimed as WorkspaceProjectForApp;
}


export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {
  router.post("/workspace/projects/initialize-default", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    const initializedProjectId = getDefaultWorkspaceProjectId(userId);
    if (initializedProjectId) {
      const project = getWorkspaceProject(userId, initializedProjectId, "workspace");
      if (!project) {
        response.json({ project: null, defaultProjectId: null });
        return;
      }
      const initialized = await initializeLocalDefaultWorkspace(aiPluginHost);
      const relocated = project.path === initialized.path
        ? project
        : updateDefaultWorkspaceProjectPath(userId, project.id, project.path, initialized.path, process.platform);
      if (!relocated) throw new ApiError(409, "workspace_default_project_changed", "默认工作区登记在恢复期间发生变化；已创建的目录和原目录均保留，请刷新后重试。 ");
      response.json({ project: relocated, defaultProjectId: relocated.id });
      return;
    }
    if (listWorkspaceProjects(userId).length || listAiSessions(userId, false).length || listAiSessions(userId, true).length) {
      response.json({ project: null, defaultProjectId: null });
      return;
    }
    const created = await initializeLocalDefaultWorkspace(aiPluginHost);
    // 首次目录解析期间允许新会话正常创建；若用户已开始工作，就不把新目录追加入旧历史。
    if (listWorkspaceProjects(userId).length || listAiSessions(userId, false).length || listAiSessions(userId, true).length) {
      response.json({ project: null, defaultProjectId: null });
      return;
    }
    const project = createWorkspaceProject({ userId, appId: "workspace", nodeId: null, path: created.path, platform: process.platform, title: "默认工作区" });
    const defaultProjectId = setDefaultWorkspaceProject(userId, project.id);
    const defaultProject = getWorkspaceProject(userId, defaultProjectId, "workspace");
    if (!defaultProject) throw new ApiError(500, "workspace_default_registration_missing", "默认工作区目录已创建，但项目登记未能读取。");
    response.status(201).json({ project: defaultProject, defaultProjectId });
  }));

  router.get("/workspace/projects", requireAuthentication, (request, response) => {
    const nodes = listDaemonNodes().filter(node => node.capabilities.includes("project-files-v1"));
    const query = parseBody<{ appId?: WorkspaceProjectApplicationId; query?: string }>(projectsQuerySchema, request.query);
    const result = searchWorkspaceProjects(request.auth!.user.id, query.appId, query.query);
    const projects = query.appId ? filterLegacyProjectsForApp(request.auth!.user.id, query.appId, result.projects) : result.projects;
    const initializedProjectId = query.appId === "minecraft" ? null : getDefaultWorkspaceProjectId(request.auth!.user.id);
    const defaultProjectId = initializedProjectId && getWorkspaceProject(request.auth!.user.id, initializedProjectId, "workspace") ? initializedProjectId : null;
    response.json({ ...result, projects, defaultProjectId, nodes: nodes.map(({ id, displayName, platform, architecture, version, status, lastSeenAt }) => ({ id, displayName, platform, architecture, version, status, lastSeenAt, local: !isRemoteDaemonIdentity(id) })) });
  });

  router.post("/workspace/projects/browse", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; nodeId: string; operation: "home" | "list" | "create-directory"; path: string; name?: string }>(browseSchema, request.body);
    const operation = body.operation === "list" ? "list_directories" : body.operation === "create-directory" ? "create_directory" : "home";
    const result = await runDirectoryOperation(request.auth!.user.id, body.appId, body.nodeId, { operation, ...(body.path ? { path: body.path } : {}), ...(body.name ? { name: body.name } : {}) });
    response.json({ result });
  }));

  router.post("/workspace/projects", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; nodeId: string; path: string; title?: string }>(createProjectSchema, request.body);
    const inspected = await runDirectoryOperation(request.auth!.user.id, body.appId, body.nodeId, { operation: "inspect_directory", path: body.path }) as { path?: unknown; directory?: unknown };
    if (typeof inspected.path !== "string" || inspected.directory !== true) throw new ApiError(400, "workspace_project_directory_invalid", "请选择 Daemon 上真实存在的文件夹。 ");
    const node = listDaemonNodes().find(item => item.id === body.nodeId);
    if (!node || node.status !== "online") throw new ApiError(409, "workspace_project_node_offline", "所选 Daemon 节点已离线，请重新选择。 ");
    try {
      response.status(201).json({ project: createWorkspaceProject({ userId: request.auth!.user.id, appId: body.appId, nodeId: node.id, path: inspected.path, platform: node.platform, ...(body.title !== undefined ? { title: body.title } : {}) }) });
    } catch (error) {
      throw new ApiError(409, "workspace_project_registration_failed", error instanceof Error ? error.message : "项目目录登记失败。 ");
    }
  }));

  router.patch("/workspace/projects/:projectId", requireAuthentication, (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; title: string }>(renameProjectSchema, request.body);
    const owned = requireProjectForApp(request.auth!.user.id, request.params.projectId, body.appId);
    const project = renameWorkspaceProject(request.auth!.user.id, request.params.projectId, body.title, owned.appId);
    if (!project) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    response.json({ project });
  });

  router.post("/workspace/projects/:projectId/git/initialize", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId }>(projectActionSchema, request.body);
    const userId = request.auth!.user.id;
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    const node = requireLocalGitProject(project);
    const authorization = authorizeExplicitUserAction({
      userId,
      activeApplicationId: body.appId,
      toolApplicationIds: [body.appId],
      toolId: "workspace.git.initialize",
      toolVersion: "1",
      risk: "dangerous",
      scopeKey: `${node?.id ?? "local"}:${project.id}`,
      executable: true
    });
    if (authorization !== "allow") throw new ApiError(403, "workspace_git_operation_not_authorized", "当前账户或应用无权初始化此项目 Git 仓库。 ");
    const status = await runLocalGitOperation(project, { operation: "initialize", projectDirectory: project.path });
    response.status(201).json({ status });
  }));

  router.post("/workspace/projects/:projectId/git/status", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId }>(projectActionSchema, request.body);
    const userId = request.auth!.user.id;
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    if (!project) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    response.json({ status: await runLocalGitOperation(project, { operation: "status" }) });
  }));

  router.post("/workspace/projects/:projectId/git/operation", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; operation: string; paths?: string[]; message?: string; branch?: string; limit?: number }>(gitWorkspaceOperationSchema, request.body);
    const userId = request.auth!.user.id;
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    const node = requireLocalGitProject(project);
    const readOnly = body.operation === "history" || body.operation === "branches";
    const risk = body.operation === "commit" || body.operation === "branch-delete" || body.operation === "branch-switch" ? "dangerous" : "write";
    if (!readOnly) {
      const authorization = authorizeExplicitUserAction({
        userId,
        activeApplicationId: body.appId,
        toolApplicationIds: [body.appId],
        toolId: `workspace.git.${body.operation}`,
        toolVersion: "1",
        risk,
        scopeKey: `${node?.id ?? "local"}:${project.id}`,
        executable: true
      });
      if (authorization !== "allow") throw new ApiError(403, "workspace_git_operation_not_authorized", "当前账户或应用无权执行此 Git 操作。 ");
    }
    let branch = body.branch;
    if (body.operation === "branch-create" && branch) {
      const prefix = getUserSettings(userId).git.branchPrefix;
      if (!branch.startsWith(prefix)) branch = `${prefix}${branch}`;
    }
    const result = await runLocalGitOperation(project, {
      operation: body.operation,
      ...(body.paths ? { paths: body.paths } : {}), ...(body.message ? { message: body.message } : {}),
      ...(branch ? { branch } : {}), ...(body.limit ? { limit: body.limit } : {})
    });
    if (body.operation === "history" || body.operation === "branches") response.json(result);
    else response.json({ status: result });
  }));

  router.post("/workspace/projects/:projectId/git/file-diff", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; path: string; ignoreWhitespace: boolean; wordDiff: boolean }>(gitFileDiffSchema, request.body);
    const userId = request.auth!.user.id;
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    requireLocalGitProject(project);
    response.json({ file: await runLocalGitOperation(project, { operation: "file-diff", path: body.path,
      ignoreWhitespace: body.ignoreWhitespace, wordDiff: body.wordDiff }) });
  }));

  router.post("/workspace/projects/:projectId/files/read", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; path: string; offset: number; limit: number }>(projectFileReadSchema, request.body);
    const project = requireProjectForApp(request.auth!.user.id, request.params.projectId, body.appId);
    const result = await runProjectFileOperation(aiPluginHost, request.auth!.user.id, body.appId, project, {
      operation: "read", rootDirectory: project.path, path: body.path, offset: body.offset, limit: body.limit
    });
    response.json({ file: result });
  }));

  router.post("/workspace/projects/:projectId/files/write", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; path: string; sha256: string; content: string }>(projectFileWriteSchema, request.body);
    const project = requireProjectForApp(request.auth!.user.id, request.params.projectId, body.appId);
    const result = await runProjectFileOperation(aiPluginHost, request.auth!.user.id, body.appId, project, {
      operation: "write", rootDirectory: project.path, path: body.path, sha256: body.sha256, content: body.content
    });
    response.json({ result });
  }));

  router.post("/workspace/projects/:projectId/git/worktrees", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId }>(createWorktreeSchema, request.body);
    const userId = request.auth!.user.id;
    const source = requireProjectForApp(userId, request.params.projectId, body.appId);
    if (!source) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    if (source.gitWorktree) throw new ApiError(409, "workspace_git_nested_worktree_unsupported", "请从原始项目创建 AI Worktree。 ");
    const node = requireLocalGitProject(source);
    if (!node) throw new ApiError(409, "workspace_git_worktree_node_required", "当前本机工作区不绑定 Daemon；此可选 Worktree 功能仍要求显式本机节点项目。 ");
    const worktreeId = randomUUID();
    const settings = getUserSettings(userId);
    const result = await runLocalGitOperation(source, {
      operation: "create-worktree", worktreeId,
      projectDirectory: source.path, projectTitle: source.title, branchPrefix: settings.git.branchPrefix
    }) as { projectDirectory?: unknown; worktreeRoot?: unknown; projectRelativePath?: unknown; branch?: unknown; baseline?: unknown; sourceHead?: unknown };
    if (typeof result.projectDirectory !== "string" || typeof result.worktreeRoot !== "string" || typeof result.projectRelativePath !== "string"
      || typeof result.branch !== "string" || typeof result.baseline !== "string" || typeof result.sourceHead !== "string") {
      let cleanupError: unknown = null;
      if (typeof result.branch === "string") {
        try { await runLocalGitOperation(source, { operation: "remove-worktree", worktreeId, sourceDirectory: source.path, branch: result.branch }); }
        catch (error) { cleanupError = error; }
      }
      const residualPath = typeof result.worktreeRoot === "string" ? result.worktreeRoot : `<LFAA_DATA_DIR>/git-worktrees/${worktreeId}`;
      const cleanupMessage = cleanupError ? ` 清理未确认成功；请检查节点 ${node.displayName} 的 ${residualPath}（工作树 ${worktreeId}）。` : "";
      throw new ApiError(502, "workspace_git_worktree_result_invalid", `Daemon 返回的 Git 工作树身份信息无效；请检查节点状态后再操作。${cleanupMessage}`);
    }
    try {
      const project = createWorkspaceGitWorktree({ userId, appId: source.appId, sourceProjectId: source.id, nodeId: node.id,
        path: result.projectDirectory, worktreeRoot: result.worktreeRoot, worktreeId, projectRelativePath: result.projectRelativePath,
        branch: result.branch, baseCommit: result.baseline, sourceHead: result.sourceHead, platform: node.platform });
      response.status(201).json({ project });
    } catch (error) {
      try {
        await runLocalGitOperation(source, { operation: "remove-worktree", worktreeId, sourceDirectory: source.path, branch: result.branch });
      } catch (cleanupError) {
        throw new ApiError(502, "workspace_git_worktree_cleanup_unconfirmed", `项目登记失败，且 Daemon 未确认清理工作树：${error instanceof Error ? error.message : "登记错误"}。请检查节点 ${node.displayName} 的 ${result.worktreeRoot}（工作树 ${worktreeId}）。`);
      }
      throw new ApiError(409, "workspace_git_worktree_registration_failed", error instanceof Error ? error.message : "Git 工作树登记失败。 ");
    }
  }));

  router.post("/workspace/projects/:projectId/git/reset", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId }>(projectActionSchema, request.body);
    const userId = request.auth!.user.id;
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    const worktree = project?.gitWorktree;
    if (!project) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    if (!worktree) throw new ApiError(409, "workspace_git_reset_not_managed", "只有 LFAA 管理的 AI Worktree 可以使用安全恢复。 ");
    response.json({ status: await runLocalGitOperation(project, { operation: "reset-worktree", worktreeId: worktree.worktreeId, baseline: worktree.baseCommit }) });
  }));

  router.delete("/workspace/projects/:projectId", requireAuthentication, asyncHandler(async (request, response) => {
    const userId = request.auth!.user.id;
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; deleteManagedWorktree: boolean }>(removeProjectSchema, request.body ?? {});
    const project = requireProjectForApp(userId, request.params.projectId, body.appId);
    if (!project) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    if (project.gitWorktree) {
      if (!body.deleteManagedWorktree) throw new ApiError(409, "workspace_git_worktree_confirmation_required", "删除 AI Worktree 会移除其中的文件；请在界面确认后重试。 ");
      const source = requireProjectForApp(userId, project.gitWorktree.sourceProjectId, body.appId);
      await runLocalGitOperation(source, { operation: "remove-worktree", worktreeId: project.gitWorktree.worktreeId, sourceDirectory: source.path, branch: project.gitWorktree.branch });
    } else if (hasWorkspaceGitWorktrees(userId, project.id)) {
      throw new ApiError(409, "workspace_git_source_has_worktrees", "请先删除此原始项目关联的 AI Worktree，再移除项目登记。 ");
    } else if (body.deleteManagedWorktree) {
      throw new ApiError(409, "workspace_git_worktree_not_managed", "此项目不是 LFAA 管理的 AI Worktree。 ");
    }
    if (!removeWorkspaceProject(userId, project.id, project.appId)) throw new ApiError(404, "workspace_project_not_found", "找不到此账户的项目。 ");
    response.status(204).end();
  }));

  router.patch("/workspace/sessions/:sessionId/project", requireAuthentication, (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; projectId: string | null }>(changeSessionProjectSchema, request.body);
    const existing = getAiSession(request.auth!.user.id, request.params.sessionId);
    if (!existing) throw new ApiError(404, "ai_session_not_found", "找不到此账户的 AI 会话。");
    if (body.appId !== "workspace" && existing.appId !== body.appId) throw new ApiError(409, "workspace_session_app_mismatch", "会话所属应用与项目应用不一致。 ");
    const project = body.projectId ? requireProjectForApp(request.auth!.user.id, body.projectId, body.appId) : null;
    const projectContext = project ? {
      id: project.id,
      appId: body.appId,
      nodeId: project.nodeId,
      path: project.path,
      title: project.title
    } : null;
    const session = setAiSessionProject(request.auth!.user.id, request.params.sessionId, projectContext);
    if (!session) {
      throw new ApiError(409, "workspace_session_busy", "任务运行期间或不支持项目目录的会话不能切换项目。");
    }
    response.json({ session });
  });

  router.post("/workspace/sessions/:sessionId/fork", requireAuthentication, limitAiBranchMemory, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: WorkspaceProjectApplicationId; messageId: string; targetProjectId: string }>(forkWorktreeSchema, request.body);
    const userId = request.auth!.user.id;
    const sourceSession = getAiSession(userId, request.params.sessionId);
    if (!sourceSession) throw new ApiError(404, "ai_session_not_found", "找不到此账户的 AI 会话。");
    if (sourceSession.appId !== body.appId || !sourceSession.projectId) throw new ApiError(409, "workspace_session_fork_source_mismatch", "只有绑定当前 App 项目的会话可以在新工作树中分支。");
    const sourceProject = requireProjectForApp(userId, sourceSession.projectId, body.appId);
    const targetProject = requireProjectForApp(userId, body.targetProjectId, body.appId);
    const worktree = targetProject.gitWorktree;
    if (sourceProject.gitWorktree || !worktree || worktree.sourceProjectId !== sourceProject.id || worktree.nodeId !== sourceProject.nodeId || targetProject.nodeId !== sourceProject.nodeId) {
      throw new ApiError(409, "workspace_session_fork_worktree_mismatch", "目标必须是在同一账户、App 与 Daemon 下从当前源项目登记的 AI Worktree。");
    }
    const projectContext: AiSessionProjectContext = { id: targetProject.id, appId: body.appId, nodeId: targetProject.nodeId, path: targetProject.path, title: targetProject.title };
    const controller = new AbortController();
    const abortOnDisconnect = () => { if (!response.writableEnded) controller.abort(); };
    request.once("aborted", abortOnDisconnect);
    response.once("close", abortOnDisconnect);
    let session;
    try {
      session = await createAiSessionBranchWithMemory(userId, sourceSession.id, body.messageId, { projectContext, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) return;
      throw new ApiError(502, "ai_session_branch_memory_failed", error instanceof Error ? error.message : "分支记忆生成失败，未创建新会话。");
    } finally {
      request.off("aborted", abortOnDisconnect);
      response.off("close", abortOnDisconnect);
    }
    if (!session) throw new ApiError(404, "ai_session_fork_target_not_found", "找不到可创建分支的完整 AI 回复。");
    response.status(201).json({ session });
  }));
}

async function runDirectoryOperation(userId: string, appId: WorkspaceProjectApplicationId, nodeId: string, operation: Record<string, unknown>, timeoutSeconds = 15): Promise<unknown> {
  const node = listDaemonNodes().find(item => item.id === nodeId);
  if (!node || node.status !== "online" || !node.capabilities.includes("project-files-v1")) throw new ApiError(409, "workspace_directory_node_unavailable", "所选节点离线或未提供项目目录能力。 ");
  return runProjectTask(userId, appId, nodeId, operation, timeoutSeconds, "workspace_directory");
}

async function initializeLocalDefaultWorkspace(aiPluginHost: AiPluginHost): Promise<{ path: string }> {
  if (!aiPluginHost.executeLocalProjectFile) throw new ApiError(503, "workspace_local_host_unavailable", "当前 LFAA Host 未提供本机工作区能力；默认项目未绑定或切换到任何节点。 ");
  const result = await aiPluginHost.executeLocalProjectFile({ operation: "initialize_default_workspace" }) as { path?: unknown };
  if (typeof result?.path !== "string") throw new ApiError(502, "workspace_default_path_invalid", "LFAA 本机 Host 没有返回已创建的默认工作区目录。 ");
  return { path: result.path };
}

async function runProjectFileOperation(aiPluginHost: AiPluginHost, userId: string, appId: WorkspaceProjectApplicationId, project: WorkspaceProjectForApp, operation: Record<string, unknown>): Promise<unknown> {
  if (project.nodeId === null) {
    if (!aiPluginHost.executeLocalProjectFile) throw new ApiError(503, "workspace_local_host_unavailable", "当前 LFAA Host 未提供本机项目文件能力。 ");
    return aiPluginHost.executeLocalProjectFile(operation);
  }
  return runDirectoryOperation(userId, appId, project.nodeId, operation);
}

function requireLocalGitProject(project: WorkspaceProjectForApp): DaemonNode | null {
  if (project.nodeId === null) return null;
  const node = listDaemonNodes().find(item => item.id === project.nodeId);
  if ((project.nodeId !== null && !isLocalDaemonIdentity(project.nodeId)) || !node || node.platform !== process.platform) {
    throw new ApiError(409, "workspace_git_local_repository_required", "此 Agent 绑定的是远程项目；Git 管理器只操作 LFAA 本机应用进程可访问的仓库，请切换到本机项目。 ");
  }
  return node;
}

async function runLocalGitOperation(project: WorkspaceProjectForApp, input: Record<string, unknown>): Promise<unknown> {
  requireLocalGitProject(project);
  const worktree = project.gitWorktree;
  const target = worktree
    ? { worktreeId: worktree.worktreeId, baseline: worktree.baseCommit, projectRelativePath: worktree.projectRelativePath }
    : { projectDirectory: project.path };
  try {
    return await executeGitWorkspace({ ...input, ...target });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LFAA 本机 Git 操作失败。";
    throw new ApiError(409, "workspace_git_operation_failed", message);
  }
}

async function runProjectTask(userId: string, appId: WorkspaceProjectApplicationId, nodeId: string, operation: Record<string, unknown>, timeoutSeconds: number, errorPrefix: "workspace_directory" | "workspace_git"): Promise<unknown> {
  const command = JSON.stringify(operation);
  const task = createAiHostTask({ nodeId, createdBy: userId, appId, shell: "project-files", workingDirectory: "", command, timeoutSeconds });
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const current = getAiHostTask(task.id);
    if (!current) throw new ApiError(404, `${errorPrefix}_task_missing`, "Daemon 工作区任务记录不可用。 ");
    if (current.status === "failed") throw new ApiError(409, `${errorPrefix}_operation_failed`, current.result?.stderr || current.message);
    if (current.status === "succeeded") {
      if (!current.result || current.result.outputTruncated) throw new ApiError(502, `${errorPrefix}_result_invalid`, "Daemon 工作区结果缺失或被截断。 ");
      try { return JSON.parse(current.result.stdout) as unknown; }
      catch { throw new ApiError(502, `${errorPrefix}_result_invalid`, "Daemon 返回的工作区结果格式无效。 "); }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new ApiError(504, `${errorPrefix}_result_pending`, "Daemon 尚未确认工作区操作结果；请先刷新节点状态，再决定是否重试，系统不会自动重放。 ");
}

/** 将目录 API 路由交给当前 API Gateway 装配。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "workspace-controller", registerRoutes); }
