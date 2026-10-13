/**
 * 功能：把「按文件名搜索」与「按内容搜索」注册为模型工具（lfaa_search_files / lfaa_grep_search）。
 * 作用：模型在大项目里先搜索定位，再用 lfaa_read_file 精确读取，避免盲目枚举。
 * 安全边界：纯只读；跳过依赖/VCS 目录、限制深度与结果条数；有工作区时路径限制在项目根内。
 * 关联文件：src/search-core.ts（递归内核）、packages/fs/fs-local/src/paths.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { projectFileAlias } from "lfaa-tools/src/project-tools.js";

/** 与 tool-fs 保持一致：工作区项目存在时把它作为只读根。 */

const searchFilesTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.search-files",
  name: "lfaa_search_files",
  coreManaged: true,
  description: "在本机项目中按文件名通配符（支持 * 与 ?）递归查找文件，返回相对路径清单（最多 100 条，结果标明截断）。自动跳过 node_modules/.git/dist 等目录。先搜索定位再读取。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      pattern: { type: "string", minLength: 1, maxLength: 200, description: "文件名通配符，如 *.ts、package*.json。" },
      path: { type: "string", maxLength: 1024, description: "搜索起点目录，缺省为工作区根。" }
    },
    required: ["pattern"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("search_files 参数必须是对象。");
    const record = value as Record<string, unknown>;
    if (typeof record.pattern !== "string" || record.pattern.trim().length === 0) throw new Error("pattern 为必填字符串。");
    const parsed: Record<string, unknown> = { pattern: record.pattern };
    if (typeof record.path === "string" && record.path.trim() !== "") parsed.path = record.path;
    return parsed;
  }
};

const grepTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.grep",
  name: "lfaa_grep_search",
  coreManaged: true,
  description: "在本机项目中递归搜索文件内容，返回匹配行（最多 100 条，每条含路径/行号/内容片段）。query 为字面文本。自动跳过二进制与依赖/VCS 目录。先 grep 定位再读取。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 200 },
      path: { type: "string", maxLength: 1024, description: "搜索起点目录，缺省为工作区根。" }
    },
    required: ["query"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("grep_search 参数必须是对象。");
    const record = value as Record<string, unknown>;
    if (typeof record.query !== "string" || record.query.trim().length === 0) throw new Error("query 为必填字符串。");
    const parsed: Record<string, unknown> = { query: record.query };
    if (typeof record.path === "string" && record.path.trim() !== "") parsed.path = record.path;
    return parsed;
  }
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
  }
}

export const name = "lfaaToolFsSearch";
export const inject = ["lfaaTools"] as const;

/** 注册文件名/内容两个只读搜索工具。 */
export function apply(ctx: Context): void {
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(searchFilesTool, "search_files"));
  ctx.lfaaTools.registerTool(ctx, projectFileAlias({ ...grepTool, description: "在目标项目中递归搜索字面文本，返回有界的匹配路径、行号和片段。" }, "search"));
}
