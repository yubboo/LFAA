/**
 * 功能：注册基于字符串精确替换的文件编辑工具 lfaa_str_replace（改已有文件的局部）。
 * 作用：模型先 lfaa_read_file 读出原文，再用本工具把唯一一段原文换成新文本，避免覆盖式写整个文件。
 * 安全边界：
 *  - old_string 必须非空且在文件中恰好出现 1 次（除非显式 replace_all），出现 0 或多次都拒绝，防误改；
 *  - 写操作走 write 风险与审批；有工作区时路径限制在项目根内；二进制文件拒绝编辑。
 * 关联文件：packages/fs/fs-local/src/local-fs.ts 的 replaceInLocalFile。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { projectFileAlias } from "lfaa-tools/src/project-tools.js";


const strReplaceTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.str-replace",
  name: "lfaa_str_replace",
  coreManaged: true,
  description: "编辑已有文本文件：把文件中唯一出现的 old_string 替换为 new_string。old_string 必须与原文逐字一致（含缩进/换行）；若出现多次会拒绝并要求你给出更长上下文使其唯一。整文件重写请用 lfaa_write_file。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      path: { type: "string", minLength: 1, maxLength: 1024 },
      old_string: { type: "string", minLength: 1, description: "要被替换的原文片段，须在文件中唯一。" },
      new_string: { type: "string", description: "替换后的新内容；传空字符串即删除该片段。" },
      replace_all: { type: "boolean", description: "替换所有匹配处，默认 false。" }
    },
    required: ["path", "old_string", "new_string"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("str_replace 参数必须是对象。");
    const record = value as Record<string, unknown>;
    if (typeof record.path !== "string" || record.path.trim().length === 0) throw new Error("path 为必填字符串。");
    if (typeof record.old_string !== "string" || record.old_string.length === 0) throw new Error("old_string 为必填且不能为空。");
    if (typeof record.new_string !== "string") throw new Error("new_string 必须是字符串。");
    return {
      path: record.path,
      old_string: record.old_string,
      new_string: record.new_string,
      replace_all: record.replace_all === true
    };
  }
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
  }
}

export const name = "lfaaToolStrReplace";
export const inject = ["lfaaTools"] as const;

/** 注册字符串替换编辑工具。 */
export function apply(ctx: Context): void {
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(strReplaceTool, "replace"));
}
