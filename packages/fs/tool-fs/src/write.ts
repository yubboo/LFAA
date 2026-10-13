/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/write.ts。
 * 功能：模型可见的整文件写入工具（创建或覆盖）。
 * 作用：解析路径（沙箱校验）→ 原子写 → 计算 before/after diff → 返回确认信封。
 * 安全边界：覆盖式写走 write 风险+审批；越界拒绝；内容上限由 fs-local 强制（2 MiB）。
 * 关联文件：sandbox.ts、diff.ts、error.ts。
 */
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

/** 校验 write 参数。 */
export function parseWriteArgs(args: { path: string; content: string }): { path: string; content: string } {
  if (typeof args.path !== "string" || args.path.trim().length === 0) throw new Error("path 为必填非空字符串。");
  if (typeof args.content !== "string") throw new Error("content 必须是字符串。");
  return { path: args.path, content: args.content };
}

/** lfaa_write_file 工具：创建或整体覆盖一个文本文件。 */
export const writeFileTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.write-file",
  name: "lfaa_write_file",
  coreManaged: true,
  description: "把完整内容写入当前目标 Daemon 项目中的一个文本文件（不存在则创建；覆盖需携带最近读取的 sha256）。这是覆盖式写入，局部修改请用 lfaa_str_replace。内容上限 2 MiB。有工作区项目时只能写项目目录内文件。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      path: { type: "string", minLength: 1, maxLength: 1024 },
      content: { type: "string", description: "文件完整新内容。" }
    },
    required: ["path", "content"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("write_file 参数必须是对象。");
    return parseWriteArgs(value as { path: string; content: string });
  }
};
