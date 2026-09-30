/**
 * 功能：将项目文件能力登记为模型可调用工具。
 * 作用：从账户设置解析默认任务目录，通过既有认证 Daemon 队列执行并返回文件证据。
 * 关联文件：business-tools.ts、jobs/ai-host-tasks.ts、host/daemon/project-files.mjs；权限由 Agent 执行管线处理。
 */
import Joi from "joi";
import { createHash } from "node:crypto";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { createAiHostTask, getAiHostTask } from "lfaa-jobs/src/ai-host-tasks.js";
import type { AiBusinessTool } from "./business-tools.js";

const schema = Joi.object({ nodeId: Joi.string().uuid().required(), operation: Joi.string().valid("list", "read", "search", "create", "replace", "diff", "discover_skills").required(), rootDirectory: Joi.string().max(32760).allow("").default(""), path: Joi.string().max(32760).allow("").default(""), offset: Joi.number().integer().min(0).max(2 * 1024 * 1024), query: Joi.string().min(1).max(500), content: Joi.string().allow("").max(2 * 1024 * 1024), oldText: Joi.string().min(1).max(2 * 1024 * 1024), newText: Joi.string().allow("").max(2 * 1024 * 1024), sha256: Joi.string().pattern(/^[a-f0-9]{64}$/u) }).unknown(false);

export const projectFileTool: AiBusinessTool = {
  id: "project.files", name: "project_file_operation", applicationIds: ["workspace"],
  description: "在指定在线节点的真实项目中列目录、检索、读文本、创建文件、用唯一锚点局部替换或查询 Git 差异。discover_skills 发现项目 .agents/skills 和 .lfaa/skills 中的真实 SKILL.md，之后用 read 按需加载。根目录默认读取设置中心任务文件夹；替换必须提供最近读取的 sha256，不能盲目覆盖。",
  schema: { type: "object", additionalProperties: false, properties: { nodeId: { type: "string", format: "uuid" }, operation: { type: "string", enum: ["list", "read", "search", "create", "replace", "diff", "discover_skills"] }, rootDirectory: { type: "string" }, path: { type: "string" }, offset: { type: "integer", minimum: 0 }, query: { type: "string" }, content: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" }, sha256: { type: "string" } }, required: ["nodeId", "operation"] },
  parse(value) { const result = schema.validate(value); if (result.error) throw new Error("项目文件工具参数无效。"); return result.value as Record<string, unknown>; },
  prepare(parameters, context) {
    const folder = getUserSettings(context.userId).general.taskFolder;
    const root = String(parameters.rootDirectory || folder);
    if (!root) throw new Error("请指定项目绝对根目录，或在设置中心保存默认任务文件夹。");
    return { ...parameters, rootDirectory: root, configuredRoot: root === folder };
  },
  risk: parameters => parameters.operation === "create" || parameters.operation === "replace" ? "write" : parameters.configuredRoot === true ? "read" : "dangerous",
  approval(parameters) { const scopeKey = createHash("sha256").update(JSON.stringify([parameters.nodeId, parameters.rootDirectory, parameters.path, parameters.operation])).digest("hex"); return { scopeKey: `project:${scopeKey}`, scopeSummary: `${parameters.rootDirectory} · ${parameters.path}`.slice(0, 240), summary: `项目文件操作：${parameters.operation}` }; },
  async execute(parameters, context) {
    const { nodeId, configuredRoot: _configuredRoot, ...input } = parameters;
    const command = JSON.stringify(input);
    if (Buffer.byteLength(command) > 8 * 1024 * 1024) throw new Error("项目任务输入过大。");
    const task = createAiHostTask({ nodeId: String(nodeId), createdBy: context.userId, appId: context.applicationId, shell: "project-files", workingDirectory: "", command, timeoutSeconds: 0 });
    let lastState = "";
    while (true) {
      context.signal.throwIfAborted();
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
