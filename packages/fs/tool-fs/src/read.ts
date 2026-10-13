/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/read.ts。
 * 功能：模型可见的 UTF-8 文本读取工具。
 * 作用：解析目标 → 读文本（有界）→ 切窗口 → 渲染带行号信封。
 * 安全边界：文件硬上限 2 MiB，窗口按行/字节封顶；二进制拒绝；越界走沙箱。
 * 关联文件：read-target.ts、read-render.ts、error.ts。
 */
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

/** 一次读取默认/最大返回行数。 */
export const READ_LIMIT = 2000;

/** 校验 read 参数：offset/limit 为正整数，limit 不超过上限。 */
export function parseReadArgs(args: { path: string; offset?: number; limit?: number }): { path: string; offset: number; limit: number } {
  if (typeof args.path !== "string" || args.path.trim().length === 0) throw new Error("path 为必填非空字符串。");
  const offset = args.offset === undefined ? 1 : args.offset;
  const limit = args.limit === undefined ? READ_LIMIT : args.limit;
  if (!Number.isInteger(offset) || offset < 1) throw new Error("offset 必须是从 1 开始的正整数。");
  if (!Number.isInteger(limit) || limit < 1 || limit > READ_LIMIT) throw new Error(`limit 必须在 1–${READ_LIMIT} 之间。`);
  return { path: args.path, offset, limit };
}

/** lfaa_read_file 工具：读取文本文件并返回带行号的窗口内容。 */
export const readFileTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.read-file",
  name: "lfaa_read_file",
  coreManaged: true,
  description: "读取当前目标 Daemon 项目中的 UTF-8 文本文件并返回带行号内容。默认前 2000 行；文件上限 2 MiB；较长输出用 offset/limit 分页。二进制被拒绝。有工作区项目时只能读项目目录内文件。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      path: { type: "string", minLength: 1, maxLength: 1024 },
      offset: { type: "integer", minimum: 1, description: "从第几行开始读（1 起）。" },
      limit: { type: "integer", minimum: 1, maximum: 2000, description: "最多返回多少行。" }
    },
    required: ["path"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("read_file 参数必须是对象。");
    return parseReadArgs(value as { path: string; offset?: number; limit?: number });
  }
};
