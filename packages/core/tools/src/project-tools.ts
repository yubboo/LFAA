/**
 * 功能：将项目文件能力登记为模型可调用工具。
 * 作用：从账户设置解析默认任务目录，通过既有认证 Daemon 队列执行并返回文件证据。
 * 关联文件：business-tools.ts、jobs/ai-host-tasks.ts、host/daemon/project-files.mjs；权限由 Agent 执行管线处理。
 */
import Joi from "joi";
import { createHash } from "node:crypto";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { createAiHostTask, getAiHostTask, requestAiHostTaskCancellation } from "lfaa-jobs/src/ai-host-tasks.js";
import type { AiBusinessTool } from "./business-tools.js";

const schema = Joi.object({ nodeId: Joi.string().uuid(), operation: Joi.string().valid("list", "read", "search", "search_markdown", "create", "create_tree", "replace", "diff", "discover_skills").required(), rootDirectory: Joi.string().max(32760).allow("").default(""), path: Joi.string().max(32760).allow("").default(""), offset: Joi.number().integer().min(0).max(2 * 1024 * 1024), query: Joi.string().min(1).max(500), content: Joi.string().allow("").max(2 * 1024 * 1024), files: Joi.array().items(Joi.object({ path: Joi.string().min(1).max(512).required(), content: Joi.string().max(2 * 1024 * 1024).required() }).unknown(false)).min(1).max(128).when("operation", { is: "create_tree", then: Joi.required(), otherwise: Joi.forbidden() }), oldText: Joi.string().min(1).max(2 * 1024 * 1024), newText: Joi.string().allow("").max(2 * 1024 * 1024), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u) }).unknown(false);

export const projectFileTool: AiBusinessTool = {
  id: "project.files", name: "project_file_operation", applicationIds: ["workspace", "minecraft"],
  description: "在当前会话选中的项目目录中列目录、检索、读文本、创建文件、原子创建一组 UTF-8 文件、用唯一锚点局部替换或查询 Git 差异；当会话未关联项目时，才需要提供真实在线节点和根目录。discover_skills 发现项目 .agents/skills 和 .lfaa/skills 中的真实 SKILL.md，之后用 read 按需加载。create_tree 只在目标目录不存在时创建完整文件树，失败时清理暂存目录且不覆盖现有内容。替换必须提供最近读取的 sha256，不能盲目覆盖。",
  schema: { type: "object", additionalProperties: false, properties: { nodeId: { type: "string", format: "uuid" }, operation: { type: "string", enum: ["list", "read", "search", "search_markdown", "create", "create_tree", "replace", "diff", "discover_skills"] }, rootDirectory: { type: "string" }, path: { type: "string" }, offset: { type: "integer", minimum: 0 }, query: { type: "string" }, content: { type: "string" }, files: { type: "array", maxItems: 128, items: { type: "object", additionalProperties: false, properties: { path: { type: "string", maxLength: 512 }, content: { type: "string", maxLength: 2097152 } }, required: ["path", "content"] } }, oldText: { type: "string" }, newText: { type: "string" }, sha256: { type: "string" } }, required: ["operation"] },
  parse(value) { const result = schema.validate(value); if (result.error || result.value.operation === "create_tree" && !result.value.path) throw new Error("项目文件工具参数无效。"); return result.value as Record<string, unknown>; },
  prepare(parameters, context) {
    const folder = getUserSettings(context.userId).general.taskFolder;
    const root = context.workspaceProject?.path ?? String(parameters.rootDirectory || folder);
    if (!root) throw new Error("请指定项目绝对根目录，或在设置中心保存默认任务文件夹。");
    const nodeId = context.workspaceProject?.nodeId ?? String(parameters.nodeId || "");
    if (!nodeId) throw new Error("请先选择项目目录，或指定真实在线 Daemon 节点。");
    return { ...parameters, nodeId, rootDirectory: root, configuredRoot: root === folder, workspaceTitle: context.workspaceProject?.title ?? null };
  },
  risk: parameters => ["create", "create_tree", "replace"].includes(String(parameters.operation)) ? "write" : parameters.configuredRoot === true ? "read" : "dangerous",
  approval(parameters) { const scopeKey = createHash("sha256").update(JSON.stringify([parameters.nodeId, parameters.rootDirectory, parameters.path, parameters.operation])).digest("hex"); return { scopeKey: `project:${scopeKey}`, scopeSummary: `${parameters.rootDirectory} · ${parameters.path}`.slice(0, 240), summary: `项目文件操作：${parameters.operation}` }; },
  async execute(parameters, context) {
    const { nodeId, configuredRoot: _configuredRoot, workspaceTitle: _workspaceTitle, ...input } = parameters;
    const command = JSON.stringify(input);
    if (Buffer.byteLength(command) > 8 * 1024 * 1024) throw new Error("项目任务输入过大。");
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
