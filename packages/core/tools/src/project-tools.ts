/**
 * 功能：将项目文件能力登记为模型可调用工具。
 * 作用：Agent 绑定本机 Git 仓库时由 LFAA 本机 Host 执行；明确的 Daemon 项目操作仍使用认证节点任务。
 * 关联文件：business-tools.ts、jobs/ai-host-tasks.ts、host/project-files；权限由 Agent 执行管线处理。
 */
import Joi from "joi";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isLocalDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { executeGitWorkspace, resolveGitProjectDirectory } from "lfaa-host-git";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { createAiHostTask, getAiHostTask, requestAiHostTaskCancellation } from "lfaa-jobs/src/ai-host-tasks.js";
import { bindAgentGitSessionRepository, registerAgentGitRepository } from "lfaa-workspace-agent-git";
import type { AiBusinessTool } from "./business-tools.js";

const schema = Joi.object({ nodeId: Joi.string().uuid(), operation: Joi.string().valid("list", "read", "search", "search_markdown", "create", "create_tree", "write", "replace", "delete", "diff", "discover_skills").required(), rootDirectory: Joi.string().max(32760).allow("").default(""), path: Joi.string().max(32760).allow("").default(""), offset: Joi.number().integer().min(0).max(2 * 1024 * 1024), limit: Joi.number().integer().min(1).max(100000).when("operation", { is: "read", then: Joi.optional(), otherwise: Joi.forbidden() }), query: Joi.string().min(1).max(500), content: Joi.string().allow("").max(2 * 1024 * 1024), files: Joi.array().items(Joi.object({ path: Joi.string().min(1).max(512).required(), content: Joi.string().max(3 * 1024 * 1024).required(), encoding: Joi.string().valid("base64") }).unknown(false)).min(1).max(128).when("operation", { is: "create_tree", then: Joi.required(), otherwise: Joi.forbidden() }), oldText: Joi.string().min(1).max(2 * 1024 * 1024), newText: Joi.string().allow("").max(2 * 1024 * 1024), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u) }).unknown(false);

export const projectFileTool: AiBusinessTool = {
  id: "project.files", name: "project_file_operation", applicationIds: [...APPLICATION_IDS],
  description: "在当前 Agent Git 仓库内列目录、检索、读写和删除普通文件、原子创建一组 UTF-8/受限 base64 文件、用唯一锚点局部替换或查询 Git 差异。代码审查应先以 diff 读取当前绑定仓库的真实变更，再按变更行查阅相关源码；没有绑定仓库或差异不可用时如实停止。审查只读，不会自动应用补丁、提交或推送。本机 Agent 仓库由 LFAA Host 执行，不要求 Daemon。远程节点文件操作只有在 Agent 绑定了 Daemon 项目且模型选择节点目标时使用。discover_skills 可发现项目 .agents/skills 和 .lfaa/skills 内的真实 SKILL.md，之后由模型按需读取。create_tree 只在目标目录不存在时创建完整文件树，失败时清理暂存目录且不覆盖现有内容。覆盖或替换必须提供最近读取的 sha256；delete 仅删除目标根目录内的普通文件，不递归删除目录。",
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
    const folder = getUserSettings(context.userId).general.taskFolder;
    if (context.agentGitRepository) {
      return { ...parameters, rootDirectory: context.agentGitRepository.path, configuredRoot: false,
        workspaceTitle: context.agentGitRepository.title, localExecution: true, agentGitRepositoryId: context.agentGitRepository.id };
    }
    if (context.workspaceProject && (context.workspaceProject.nodeId === null || isLocalDaemonIdentity(context.workspaceProject.nodeId))) {
      return { ...parameters, rootDirectory: context.workspaceProject.path, configuredRoot: false,
        workspaceTitle: context.workspaceProject.title, localExecution: true, trustedLocalRoot: true };
    }
    if (!context.workspaceProject && !parameters.nodeId && folder) {
      return { ...parameters, rootDirectory: folder, configuredRoot: true,
        workspaceTitle: "默认任务文件夹", localExecution: true, trustedLocalRoot: true };
    }
    const root = context.workspaceProject?.path ?? String(parameters.rootDirectory || folder);
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
    const { nodeId, configuredRoot: _configuredRoot, trustedLocalRoot, workspaceTitle: _workspaceTitle, localExecution, agentGitRepositoryId: _agentGitRepositoryId, ...input } = parameters;
    const command = JSON.stringify(input);
    if (Buffer.byteLength(command) > 8 * 1024 * 1024) throw new Error("项目任务输入过大。");
    if (localExecution === true) {
      const repositoryRoot = context.agentGitRepository?.path;
      const workspaceRoot = context.workspaceProject && (context.workspaceProject.nodeId === null || isLocalDaemonIdentity(context.workspaceProject.nodeId)) ? context.workspaceProject.path : "";
      const taskFolder = getUserSettings(context.userId).general.taskFolder;
      const root = typeof input.rootDirectory === "string" ? resolve(input.rootDirectory) : "";
      const trustedRoot = Boolean(repositoryRoot && resolve(repositoryRoot) === root)
        || trustedLocalRoot === true && (Boolean(workspaceRoot && resolve(workspaceRoot) === root) || Boolean(taskFolder && resolve(taskFolder) === root));
      if (!trustedRoot || typeof context.executeLocalProjectFile !== "function") throw new Error("当前 Agent 会话没有可用的受信任本机工作目录或本机文件 Host。");
      if (["create", "create_tree", "write", "replace", "delete"].includes(String(input.operation))) {
        const projectDirectory = await resolveGitProjectDirectory(root);
        const status = await executeGitWorkspace({ operation: "status", projectDirectory });
        if (status.repositoryState === "not-repository") await executeGitWorkspace({ operation: "initialize", projectDirectory });
        const repository = registerAgentGitRepository({ userId: context.userId, path: projectDirectory, title: String(parameters.workspaceTitle || "项目") });
        if (context.sessionId && !bindAgentGitSessionRepository(context.userId, context.sessionId, repository.id)) {
          throw new Error("项目目录的 Agent Git 会话绑定失败，文件尚未写入。 ");
        }
      }
      return { result: await context.executeLocalProjectFile(input) };
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
