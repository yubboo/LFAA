/**
 * 功能：把 Agent 明确完成的项目文件登记为可下载交付物。
 * 作用：只使用当前 Run 绑定的本机 Agent Git 根目录和 Project Files Host。
 * 不负责：编译项目、猜测输出目录、复制文件或返回二进制内容。
 */
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { makeTool, strictObject, parseWithSchema, type AiBusinessTool } from "lfaa-tools/src/tool-contract.js";
import { publishAgentDeliverable } from "lfaa-deliverables-workspace-changes";

const publishSchema = Joi.object({
  path: Joi.string().trim().min(1).max(32760).required().custom((value: string, helpers) => {
    const segments = value.split("/");
    return value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)
      || segments.some(segment => !segment || segment === "." || segment === "..") ? helpers.error("string.pattern.base") : value;
  }),
  title: Joi.string().trim().min(1).max(160).optional()
}).unknown(false);

const tool: AiBusinessTool = makeTool({
  id: "deliverables.publish",
  name: "deliverable_publish",
  applicationIds: ["workspace"],
  coreManaged: true,
  description: "将当前项目中已完成、用户可直接下载使用的最终文件发布到资产库。仅在代码/文件已经完成且所需构建或验证真实成功后调用；path 必须是当前 Agent Git 项目根目录内的项目相对路径。它会用本机 Project Files Owner 检查文件存在、普通文件类型、摘要和大小，并按账户/项目登记；不会编译、自动搜索文件、复制文件或把源码变成资产。登记失败时按真实结果修复或报告，不可声称发布成功。",
  schema: strictObject({ path: { type: "string", maxLength: 32760, description: "当前项目根目录内的普通文件相对路径，不允许绝对路径或跳出项目。" }, title: { type: "string", maxLength: 160, description: "资产库中显示的简短名称。" } }, ["path"]),
  parse: value => parseWithSchema(publishSchema, value),
  prepare(parameters, context) {
    const repository = context.agentGitRepository;
    if (!repository) throw new Error("当前会话尚未绑定本机 Agent Git 项目，不能发布项目产物。 ");
    return { ...parameters, rootDirectory: repository.path, repositoryId: repository.id };
  },
  risk: () => "write",
  approval: parameters => ({ scopeKey: `deliverable:${String(parameters.repositoryId)}:${String(parameters.path)}`, scopeSummary: `${String(parameters.path)}`.slice(0, 240), summary: "将已完成的项目文件登记到资产库供下载" }),
  async execute(parameters, context) {
    if (!context.sessionId) throw new Error("当前 Agent Run 没有可关联的会话，未登记产物。 ");
    if (typeof context.executeLocalProjectFile !== "function") throw new Error("当前 LFAA Host 未提供本机项目文件校验能力，未登记产物。 ");
    const file = await context.executeLocalProjectFile({ operation: "inspect_artifact", rootDirectory: parameters.rootDirectory, path: parameters.path }, context.signal) as {
      relativePath?: unknown; fileName?: unknown; sizeBytes?: unknown; sha256?: unknown; modifiedAt?: unknown;
    };
    if (typeof file.relativePath !== "string" || typeof file.fileName !== "string" || typeof file.sizeBytes !== "number"
      || typeof file.sha256 !== "string" || typeof file.modifiedAt !== "string") throw new Error("Project Files Owner 未返回完整产物核验结果，未登记。 ");
    context.signal.throwIfAborted();
    const deliverable = publishAgentDeliverable({
      userId: context.userId,
      repositoryId: String(parameters.repositoryId),
      sessionId: context.sessionId,
      path: file.relativePath,
      title: typeof parameters.title === "string" ? parameters.title : file.fileName,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      modifiedAt: file.modifiedAt
    });
    return { published: true, id: deliverable.id, title: deliverable.title, fileName: deliverable.fileName, path: deliverable.path,
      sizeBytes: deliverable.sizeBytes, sha256: deliverable.sha256, publishedAt: deliverable.publishedAt };
  }
});

export const name = "lfaa-deliverables-tool-present";
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.lfaaTools.registerTool(ctx, tool), "agent-deliverables-publish-tool");
}
