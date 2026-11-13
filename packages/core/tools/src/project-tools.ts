/**
 * 功能：将项目文件能力登记为模型可调用工具。
 * 作用：Agent 绑定本机 Git 仓库时由 LFAA 本机 Host 执行；明确的 Daemon 项目操作仍使用认证节点任务。
 * 关联文件：business-tools.ts、jobs/ai-host-tasks.ts、host/project-files；权限由 Agent 执行管线处理。
 */
import Joi from "joi";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { isLocalDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { executeGitWorkspace, resolveGitProjectDirectory } from "lfaa-host-git";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { createLocalWorkspaceProject, getDefaultWorkspaceProjectId, getDefaultWorkspaceProjectPath, getWorkspaceProject, workspaceProjectDirectoryName, type WorkspaceProjectApplicationId } from "lfaa-workspace-workspace/src/index.js";
import { createWorkspaceGitWorktreeFromProject } from "lfaa-workspace-workspace/src/git-worktree-operations.js";
import { getAiSession, setAiSessionProjectFromAgent } from "lfaa-session/src/sessions.js";
import { createAiHostTask, getAiHostTask, requestAiHostTaskCancellation } from "lfaa-jobs/src/ai-host-tasks.js";
import { bindAgentGitSessionRepository, registerAgentGitRepository } from "lfaa-workspace-agent-git";
import type { AiBusinessTool } from "./business-tools.js";

const schema = Joi.object({ nodeId: Joi.string().uuid(), operation: Joi.string().valid("list", "read", "search", "search_markdown", "create", "create_tree", "write", "replace", "delete", "diff", "discover_skills").required(), rootDirectory: Joi.string().max(32760).allow("").default(""), path: Joi.string().max(32760).allow("").default(""), offset: Joi.number().integer().min(0).max(2 * 1024 * 1024), limit: Joi.number().integer().min(1).max(100000).when("operation", { is: "read", then: Joi.optional(), otherwise: Joi.forbidden() }), query: Joi.string().min(1).max(500), content: Joi.string().allow("").max(2 * 1024 * 1024), files: Joi.array().items(Joi.object({ path: Joi.string().min(1).max(512).required(), content: Joi.string().max(3 * 1024 * 1024).required(), encoding: Joi.string().valid("base64") }).unknown(false)).min(1).max(128).when("operation", { is: "create_tree", then: Joi.required(), otherwise: Joi.forbidden() }), oldText: Joi.string().min(1).max(2 * 1024 * 1024), newText: Joi.string().allow("").max(2 * 1024 * 1024), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u) }).unknown(false);
const readOnlyProjectOperations = new Set(["list", "read", "read_lines", "read_image", "search", "search_files", "search_markdown", "diff", "discover_skills"]);

function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left), normalizedRight = resolve(right);
  return process.platform === "win32" ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US") : normalizedLeft === normalizedRight;
}

const createWorkspaceProjectSchema = Joi.object({ title: Joi.string().trim().min(1).max(120).required() }).unknown(false);
const createWorkspaceGitWorktreeSchema = Joi.object({}).unknown(false);

export const createWorkspaceProjectTool: AiBusinessTool = {
  id: "workspace.projects.create",
  name: "workspace_create_project",
  applicationIds: ["workspace"],
  coreManaged: true,
  activityTitle: "创建工作区项目",
  description: "按用户目标为可持续、多轮的工作创建一个专用项目文件夹，并把当前通用 Work 会话归入项目；小问题、一次性问答或用户没有要求独立管理时继续使用当前/默认工作区，不要每次聊天都创建项目。项目名优先采用用户指定名称，否则生成简短易辨认名称。文件夹与默认工作区并列创建，用户可在侧栏项目列表中继续查看会话；创建后本轮后续 project_file_operation 也会切换到新目录。只在默认工作区已初始化、当前会话仍使用默认工作区且有本机 Project Files Host 时可用。",
  schema: { type: "object", additionalProperties: false, properties: { title: { type: "string", minLength: 1, maxLength: 120 } }, required: ["title"] },
  parse(value) {
    const validated = createWorkspaceProjectSchema.validate(value);
    if (validated.error) throw new Error("项目名称无效。请使用 1 至 120 个字符的可用名称。");
    return validated.value as Record<string, unknown>;
  },
  risk: () => "write",
  approval: parameters => {
    const title = String(parameters.title ?? "");
    const scopeKey = createHash("sha256").update(title.trim().toLocaleLowerCase("zh-CN")).digest("hex");
    return { scopeKey: `workspace:project:create:${scopeKey}`, scopeSummary: title.slice(0, 120), summary: `在默认工作区旁创建项目文件夹“${title.slice(0, 80)}”，并将当前会话归入项目` };
  },
  execute: async (parameters, context) => {
    if (!context.sessionId) throw new Error("当前运行没有可绑定的 Work 会话，项目尚未创建。");
    if (!context.executeLocalProjectFile) throw new Error("当前 LFAA Host 未提供本机项目文件夹创建能力，项目尚未创建。");
    const session = getAiSession(context.userId, context.sessionId);
    if (!session || session.appId !== "workspace") throw new Error("只能为当前账户的通用 Work 会话创建项目。");
    const defaultProjectId = getDefaultWorkspaceProjectId(context.userId);
    if (session.projectId && session.projectId !== defaultProjectId) throw new Error("当前会话已关联专用项目；请继续使用该项目或在新会话中创建另一个项目。");
    const defaultPath = getDefaultWorkspaceProjectPath(context.userId);
    if (!defaultProjectId || !defaultPath) throw new Error("默认工作区尚未初始化，请先在 AI Work 项目侧栏选择或创建一个可用项目。");
    const title = String(parameters.title);
    const directoryName = workspaceProjectDirectoryName(title);
    if (!directoryName) throw new Error("项目名称不能作为本机文件夹名称，请移除 Windows 不支持的字符或保留设备名。");
    context.signal.throwIfAborted();
    const parent = await context.executeLocalProjectFile({ operation: "inspect_directory", path: dirname(defaultPath) }, context.signal) as { path?: unknown; directory?: unknown };
    if (typeof parent.path !== "string" || parent.directory !== true) throw new Error("默认工作区的父文件夹不可用；没有创建项目。");
    const createdDirectory = await context.executeLocalProjectFile({ operation: "create_directory", path: parent.path, name: directoryName }, context.signal) as { path?: unknown; created?: unknown };
    if (createdDirectory.created !== true || typeof createdDirectory.path !== "string") throw new Error(`工作区中已存在“${directoryName}”文件夹，请选择其他项目名称。`);
    const project = createLocalWorkspaceProject({ userId: context.userId, title, projectDirectoryPath: createdDirectory.path, platform: process.platform });
    const projectContext = {
      id: project.id,
      appId: "workspace" as const,
      nodeId: null,
      path: project.path,
      title: project.title,
      sources: project.sources.map(source => source.path),
      sourceDirectories: project.sources.map(source => ({ id: source.id, path: source.path })),
      ...(project.instructions ? { instructions: project.instructions } : {}),
      ...(project.applicationIds?.length ? { applicationIds: project.applicationIds } : {}),
      ...(project.memoryMode ? { memoryMode: project.memoryMode } : {})
    };
    const linkedSession = setAiSessionProjectFromAgent(context.userId, context.sessionId, projectContext, session.projectId);
    if (!linkedSession) return { created: true, projectId: project.id, title: project.title, linkedSession: false, message: "项目文件夹已真实创建并登记，但当前会话状态已变化，未能自动关联。" };
    context.updateWorkspaceProject?.(projectContext);
    return { created: true, projectId: project.id, title: project.title, folderName: directoryName, linkedSession: true };
  }
};

export const createWorkspaceGitWorktreeTool: AiBusinessTool = {
  id: "workspace.git-worktree.create",
  name: "workspace_create_worktree",
  applicationIds: ["workspace", "minecraft"],
  coreManaged: true,
  onDemand: true,
  activityTitle: "创建并切换 AI Worktree",
  description: "当当前会话项目需要隔离的 Git 工作区时，为当前绑定项目创建 LFAA 管理的 AI Worktree，并将当前会话和本轮后续项目操作切换到新工作区。通用 AI Work 只操作由 LFAA 本机 Host 管理的项目；Minecraft 等 App 项目只操作绑定当前本机 Daemon 的项目。不能从远程项目或已有 Worktree 再创建。不要指定项目 ID、路径或分支前缀；目标严格来自当前会话，分支前缀读取 Git 设置。",
  schema: { type: "object", additionalProperties: false, properties: {} },
  parse(value) {
    const validated = createWorkspaceGitWorktreeSchema.validate(value);
    if (validated.error) throw new Error("Worktree 工具不接受参数；它只操作当前会话绑定的项目。 ");
    return {};
  },
  risk: () => "write",
  approval: (_parameters, context) => {
    const projectId = context.workspaceProject?.id ?? "unbound";
    const scopeKey = createHash("sha256").update(JSON.stringify([context.applicationId, projectId])).digest("hex");
    return { scopeKey: `workspace:git-worktree:${scopeKey}`, scopeSummary: `${context.workspaceProject?.title ?? "当前会话项目"} · AI Worktree`, summary: "在当前会话项目创建隔离 Git Worktree 并切换当前会话" };
  },
  async execute(_parameters, context) {
    const appId = context.applicationId;
    if (appId !== "workspace" && appId !== "minecraft") throw new Error("当前应用不支持 Workspace Git Worktree。 ");
    const currentProject = context.workspaceProject;
    const sessionId = context.sessionId;
    if (!sessionId || !currentProject?.id) throw new Error("当前 Agent Session 没有已绑定的项目，未创建 Worktree。 ");
    if (!context.updateWorkspaceProject) throw new Error("当前 Agent Run 无法安全更新项目上下文，未创建 Worktree。 ");
    const session = getAiSession(context.userId, sessionId);
    if (!session || session.appId !== appId || session.projectId !== currentProject.id) throw new Error("当前会话项目已变化；请重新读取会话后再创建 Worktree。 ");
    const source = getWorkspaceProject(context.userId, currentProject.id, appId as WorkspaceProjectApplicationId);
    if (!source || source.id !== currentProject.id) throw new Error("当前项目已不属于此账户或应用，未创建 Worktree。 ");

    const worktree = await createWorkspaceGitWorktreeFromProject({ userId: context.userId, appId: appId as WorkspaceProjectApplicationId,
      sourceProjectId: source.id, branchPrefix: getUserSettings(context.userId).git.branchPrefix, signal: context.signal });
    const projectContext = {
      id: worktree.id,
      appId: appId as WorkspaceProjectApplicationId,
      applicationIds: worktree.applicationIds,
      nodeId: worktree.nodeId,
      path: worktree.path,
      title: worktree.title,
      sources: worktree.sources.map(item => item.path),
      sourceDirectories: worktree.sources.map(item => ({ id: item.id, path: item.path })),
      instructions: worktree.instructions,
      memoryMode: worktree.memoryMode
    };
    const boundSession = setAiSessionProjectFromAgent(context.userId, sessionId, projectContext, source.id);
    if (!boundSession) return { created: true, switched: false, projectId: worktree.id, title: worktree.title, branch: worktree.gitWorktree?.branch ?? null, message: "Worktree 已创建并登记，但会话项目在切换前发生变化；当前会话未切换。请在项目列表核对新 Worktree。" };
    context.updateWorkspaceProject(projectContext);
    return { created: true, switched: true, projectId: worktree.id, title: worktree.title, branch: worktree.gitWorktree?.branch ?? null, baseCommit: worktree.gitWorktree?.baseCommit ?? null };
  }
};

export const projectFileTool: AiBusinessTool = {
  id: "project.files", name: "project_file_operation", applicationIds: [...APPLICATION_IDS],
  description: "在项目根内列目录、检索、读取或按现有合同修改普通文件，也可查询 Git 差异。用户明确给出本机绝对项目目录并要求查看/理解时，将原路径作为 rootDirectory；它优先于当前会话绑定目录，无显式 nodeId 时由 LFAA 本机 Host 读取，不要求 Daemon。未登记的本机目录仅支持只读查看，仍按现有 Permission Owner 的危险读取风险授权；要写入时先把项目登记到 Agent Git 工作区。理解项目时先列根目录，再按需读取 README、AGENTS、包清单、配置和入口文件，配合有界搜索补充证据；优先用项目导航和架构说明建立整体认识，只沿任务相关或主要包的入口继续追踪，不递归读取每个包或整篇大型文档。证据足以说明项目用途、主要边界和运行入口后及时总结，并注明未覆盖部分；用户若明确要求全量文件盘点，再按实际可见数量分阶段处理。只总结真实读到的内容，不尝试一次性读取全部文件，也不声称全量读完。修改现有代码时先读取目标源码和相关差异，默认使用局部 replace 并保留其它内容；写后读取真实 diff 核对范围，整文件覆盖仅在用户要求或目标确需整体重建时使用。代码审查应先以 diff 读取当前绑定仓库的真实变更，再按变更行查阅相关源码；没有绑定仓库或差异不可用时如实停止，不自动应用补丁、提交或推送。只有模型明确选择远程节点并传入 nodeId 时才走节点执行器。discover_skills 可发现项目 .agents/skills 和 .lfaa/skills 内的真实 SKILL.md，之后由模型按需读取。create_tree 只在目标目录不存在时创建完整文件树，失败时清理暂存目录且不覆盖现有内容。覆盖或替换必须提供最近读取的 sha256；delete 仅删除目标根目录内的普通文件，不递归删除目录。",
  schema: { type: "object", additionalProperties: false, properties: { nodeId: { type: "string", format: "uuid" }, operation: { type: "string", enum: ["list", "read", "search", "search_markdown", "create", "create_tree", "write", "replace", "delete", "diff", "discover_skills"] }, rootDirectory: { type: "string" }, path: { type: "string" }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 100000, description: "read 操作的最大字符数。" }, query: { type: "string" }, content: { type: "string" }, files: { type: "array", maxItems: 128, items: { type: "object", additionalProperties: false, properties: { path: { type: "string", maxLength: 512 }, content: { type: "string", maxLength: 3145728 }, encoding: { type: "string", enum: ["base64"] } }, required: ["path", "content"] } }, oldText: { type: "string" }, newText: { type: "string" }, sha256: { type: "string", description: "覆盖或替换已有文件时必须使用最近读取返回的摘要。" } }, required: ["operation"] },
  parse(value) {
    const result = schema.validate(value);
    const operation = result.value?.operation;
    if (result.error || operation === "create_tree" && !result.value.path || operation === "delete" && !result.value.path
      || operation === "write" && (!result.value.path || typeof result.value.content !== "string" || !result.value.sha256)
      || operation === "replace" && (!result.value.path || !result.value.sha256)) throw new Error("项目文件工具参数无效。");
    return result.value as Record<string, unknown>;
  },
  prepare(parameters, context) {
    const configuredFolder = getUserSettings(context.userId).general.taskFolder.trim();
    const folder = configuredFolder || getDefaultWorkspaceProjectPath(context.userId) || "";
    const requestedRoot = typeof parameters.rootDirectory === "string" ? parameters.rootDirectory.trim() : "";
    const projectSources = context.workspaceProject?.sourceDirectories?.length
      ? context.workspaceProject.sourceDirectories
      : (context.workspaceProject?.sources ?? (context.workspaceProject?.path ? [context.workspaceProject.path] : [])).map(path => ({ id: "", path }));
    const projectRoots = projectSources.map(source => source.path);
    const sameLocalPath = (left: string, right: string) => {
      const normalizedLeft = resolve(left), normalizedRight = resolve(right);
      return process.platform === "win32" ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US") : normalizedLeft === normalizedRight;
    };
    if (requestedRoot && !parameters.nodeId) {
      if (!isAbsolute(requestedRoot)) throw new Error("用户指定的本机项目根目录必须是绝对路径。 ");
      const root = resolve(requestedRoot);
      const localProject = context.workspaceProject
        && (context.workspaceProject.nodeId === null || isLocalDaemonIdentity(context.workspaceProject.nodeId));
      const isProjectRoot = Boolean(localProject && projectRoots.some(path => sameLocalPath(path, root)));
      const selectedSource = localProject ? projectSources.find(source => sameLocalPath(source.path, root)) : undefined;
      const boundRepositoryMatches = Boolean(context.agentGitRepository && resolve(context.agentGitRepository.path) === root);
      const trustedLocalRoot = boundRepositoryMatches || isProjectRoot
        || !context.workspaceProject && Boolean(folder && sameLocalPath(folder, root));
      if (!trustedLocalRoot && !readOnlyProjectOperations.has(String(parameters.operation))) {
        throw new Error("未登记的本机项目目录目前只支持只读查看；请先将项目登记到 Agent Git 工作区后再写入。 ");
      }
      return {
        ...parameters,
        rootDirectory: requestedRoot,
        configuredRoot: false,
        workspaceTitle: isProjectRoot ? context.workspaceProject?.title : "用户指定的本机项目目录",
        localExecution: true,
        explicitLocalRoot: true,
        ...(selectedSource?.id ? { projectSourceId: selectedSource.id } : {}),
        ...(trustedLocalRoot ? { trustedLocalRoot: true } : {}),
        ...(boundRepositoryMatches && context.agentGitRepository ? { agentGitRepositoryId: context.agentGitRepository.id } : {})
      };
    }
    if (context.agentGitRepository) {
      const root = context.agentGitRepository.path;
      const selectedSource = context.workspaceProject && projectSources.find(source => sameLocalPath(source.path, root));
      return { ...parameters, rootDirectory: context.agentGitRepository.path, configuredRoot: false,
        workspaceTitle: context.agentGitRepository.title, localExecution: true, agentGitRepositoryId: context.agentGitRepository.id,
        ...(selectedSource?.id ? { projectSourceId: selectedSource.id } : {}) };
    }
    if (context.workspaceProject && (context.workspaceProject.nodeId === null || isLocalDaemonIdentity(context.workspaceProject.nodeId))) {
      if (!projectRoots.length) throw new Error("当前项目还没有关联本机源文件夹；请在项目管理中添加文件夹后再执行文件操作。");
      if (projectRoots.length > 1) throw new Error("当前项目关联了多个本机源文件夹，请从项目上下文提供的路径中选择一个 `rootDirectory` 后再执行。");
      return { ...parameters, rootDirectory: projectRoots[0], configuredRoot: false,
        workspaceTitle: context.workspaceProject.title, localExecution: true, trustedLocalRoot: true,
        ...(projectSources[0]?.id ? { projectSourceId: projectSources[0].id } : {}) };
    }
    if (!context.workspaceProject && !parameters.nodeId && folder) {
      return { ...parameters, rootDirectory: folder, configuredRoot: Boolean(configuredFolder),
        workspaceTitle: configuredFolder ? "默认任务文件夹" : "默认工作区", localExecution: true, trustedLocalRoot: true };
    }
    const root = context.workspaceProject?.path || String(parameters.rootDirectory || configuredFolder);
    if (!root) throw new Error("请指定项目绝对根目录，或在设置中心保存默认任务文件夹。");
    const nodeId = context.workspaceProject?.nodeId ?? String(parameters.nodeId || "");
    if (!nodeId) throw new Error("请先选择项目目录，或指定真实在线 Daemon 节点。");
    return { ...parameters, nodeId, rootDirectory: root, configuredRoot: false, workspaceTitle: context.workspaceProject?.title ?? null, localExecution: false };
  },
  risk(parameters) {
    const operation = String(parameters.operation);
    if (operation === "delete") return "dangerous";
    if (["create", "create_tree", "replace", "write"].includes(operation)) return "write";
    return parameters.configuredRoot === true || parameters.trustedLocalRoot === true || typeof parameters.agentGitRepositoryId === "string" ? "read" : "dangerous";
  },
  approval(parameters) { const scopeKey = createHash("sha256").update(JSON.stringify([parameters.agentGitRepositoryId ?? parameters.nodeId, parameters.rootDirectory, parameters.path, parameters.operation])).digest("hex"); return { scopeKey: `project:${scopeKey}`, scopeSummary: `${parameters.rootDirectory} · ${parameters.path}`.slice(0, 240), summary: `项目文件操作：${parameters.operation}` }; },
  async execute(parameters, context) {
    const { nodeId, configuredRoot: _configuredRoot, trustedLocalRoot, explicitLocalRoot, workspaceTitle: _workspaceTitle,
      projectSourceId: _projectSourceId, localExecution, agentGitRepositoryId: _agentGitRepositoryId, ...input } = parameters;
    const command = JSON.stringify(input);
    if (Buffer.byteLength(command) > 8 * 1024 * 1024) throw new Error("项目任务输入过大。");
    if (localExecution === true) {
      const repositoryRoot = context.agentGitRepository?.path;
      const workspaceRoots = context.workspaceProject && (context.workspaceProject.nodeId === null || isLocalDaemonIdentity(context.workspaceProject.nodeId))
        ? context.workspaceProject.sources?.length ? context.workspaceProject.sources : context.workspaceProject.path ? [context.workspaceProject.path] : [] : [];
      const taskFolder = getUserSettings(context.userId).general.taskFolder.trim() || getDefaultWorkspaceProjectPath(context.userId) || "";
      const root = typeof input.rootDirectory === "string" ? resolve(input.rootDirectory) : "";
      const trustedRoot = Boolean(repositoryRoot && resolve(repositoryRoot) === root)
        || trustedLocalRoot === true && (workspaceRoots.some(source => samePath(source, root)) || !context.workspaceProject && Boolean(taskFolder && samePath(taskFolder, root)));
      if (typeof context.executeLocalProjectFile !== "function") throw new Error("当前 LFAA Host 未提供本机文件读取能力。 ");
      if (!trustedRoot && !(explicitLocalRoot === true && readOnlyProjectOperations.has(String(input.operation)))) {
        throw new Error("当前 Agent 会话没有可用的受信任本机工作目录；未登记的显式本机项目目录仅支持只读查看。 ");
      }
      if (["create", "create_tree", "write", "replace", "delete"].includes(String(input.operation))) {
        const projectDirectory = await resolveGitProjectDirectory(root);
        const status = await executeGitWorkspace({ operation: "status", projectDirectory });
        if (status.repositoryState === "not-repository") await executeGitWorkspace({ operation: "initialize", projectDirectory });
        const repository = registerAgentGitRepository({ userId: context.userId, path: projectDirectory, title: String(parameters.workspaceTitle || "项目") });
        if (context.sessionId && !bindAgentGitSessionRepository(context.userId, context.sessionId, repository.id)) {
          throw new Error("项目目录的 Agent Git 会话绑定失败，文件尚未写入。 ");
        }
      }
      context.signal?.throwIfAborted();
      return { result: await context.executeLocalProjectFile(input, context.signal) };
    }
    if (typeof nodeId !== "string" || !nodeId) throw new Error("当前文件目标未绑定有效 Daemon 节点。");
    const task = createAiHostTask({ nodeId: String(nodeId), createdBy: context.userId, appId: context.applicationId, shell: "project-files", workingDirectory: "", command, timeoutSeconds: 0 });
    let lastState = "";
    while (true) {
      if (context.signal.aborted) { requestAiHostTaskCancellation(task.id, context.userId); context.signal.throwIfAborted(); }
      const current = getAiHostTask(task.id);
      if (!current) throw new Error("找不到已派发的项目文件任务。");
      if (current.status === "failed") throw new Error(current.result?.stderr || current.message);
      if (current.status === "succeeded") {
        if (!current.result || current.result.outputTruncated) throw new Error("节点文件结果缺失或截断，请缩小读取范围。");
        return { taskId: current.id, result: JSON.parse(current.result.stdout) as unknown };
      }
      const state = `${current.status}:${current.message}`;
      if (state !== lastState) { context.onProgress(current.message); lastState = state; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
};

/** 通用文件工具只翻译参数；文件范围与权限由项目文件工具解析，本机 Agent 使用 LFAA Host，节点操作使用 Daemon 执行器。 */
export function projectFileAlias(tool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse">, operation: string): AiBusinessTool {
  return {
    ...tool,
    description: `${tool.description} 本机 Agent Git 仓库由 LFAA 本机 Host 操作；目标 Daemon 文件操作仍通过节点执行器。工具优先使用当前 Agent Git 仓库或可选会话项目；修改已有文件必须携带最近读取的 sha256，新建文件不携带 sha256。`,
    schema: { ...tool.schema, properties: { ...(tool.schema.properties as Record<string, unknown>), nodeId: { type: "string", format: "uuid" }, rootDirectory: { type: "string", maxLength: 32760 }, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" } } },
    parse(value) {
      const envelope = Joi.object({ nodeId: Joi.string().uuid(), rootDirectory: Joi.string().max(32760), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u) }).unknown(true).validate(value, { convert: false });
      if (envelope.error) throw new Error("文件工具目标或摘要参数无效。");
      const { nodeId, rootDirectory, sha256, ...argumentsValue } = envelope.value;
      return { ...tool.parse(argumentsValue), ...(nodeId ? { nodeId } : {}), ...(rootDirectory ? { rootDirectory } : {}), ...(sha256 ? { sha256 } : {}) };
    },
    prepare(parameters, context) {
      const mapped = { ...parameters, operation: operation === "write" && !parameters.sha256 ? "create" : operation,
        ...(operation === "read_lines" ? { lineOffset: parameters.offset, lineLimit: parameters.limit } : {}),
        ...(operation === "search_files" ? { query: parameters.pattern } : {}),
        ...(operation === "replace" ? { oldText: parameters.old_string, newText: parameters.new_string } : {}) };
      return projectFileTool.prepare!(mapped, context);
    },
    risk: parameters => String(parameters.operation) === "delete" ? "dangerous" : ["write", "create", "replace"].includes(String(parameters.operation)) ? "write" : projectFileTool.risk(parameters),
    approval: projectFileTool.approval,
    execute: projectFileTool.execute
  };
}
