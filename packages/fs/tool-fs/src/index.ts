/**
 * 功能：把本机文件「读/写/列目录/读图片」注册为模型可选择的工具（lfaa_read_file/lfaa_write_file/lfaa_list_directory/lfaa_read_image）。
 * 作用：AI Work 一句话需求后，模型通过这些工具真正读写本机项目文件。
 * 模块划分（对齐 DSH tool-fs 能力面）：read.ts/read-target.ts/read-render.ts/read-image.ts、write.ts、edit.ts、diff.ts、error.ts、session-cwd.ts、sandbox.ts。
 * 安全边界：工作区根 containment、大小上限、二进制拒绝、写操作走审批；详见各模块中文注释。
 * 关联文件：packages/fs/fs-local/src、packages/core/tools/src/business-tools.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { readFileTool } from "./read.js";
import { writeFileTool } from "./write.js";
import { projectFileAlias } from "lfaa-tools/src/project-tools.js";

/** lfaa_delete_file：删除目标项目中的单个普通文件，不接受目录或符号链接。 */
const deleteFileTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.delete-file",
  name: "lfaa_delete_file",
  coreManaged: true,
  description: "删除目标项目中的一个普通文件。只删除该文件本身，不删除目录或递归清理；path 为相对项目根目录的路径。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: { path: { type: "string", minLength: 1, maxLength: 1024, description: "要删除的项目相对路径。" } },
    required: ["path"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("delete_file 参数必须是对象。");
    const record = value as Record<string, unknown>;
    if (typeof record.path !== "string" || record.path.trim().length === 0) throw new Error("path 为必填非空字符串。");
    return { path: record.path };
  }
};

/** lfaa_list_directory：列目录直接子项（只返回元数据，不读内容）。 */
const listDirTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.list-dir",
  name: "lfaa_list_directory",
  coreManaged: true,
  description: "列出当前目标 Daemon 项目目录的直接子项（名称/类型），按名称排序，不读取文件内容。path 缺省列工作区根目录。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: { path: { type: "string", maxLength: 1024 } },
    required: [],
    additionalProperties: false
  },
  parse(value) {
    if (value === undefined || value === null) return {};
    if (typeof value !== "object" || Array.isArray(value)) throw new Error("list_directory 参数必须是对象。");
    const record = value as Record<string, unknown>;
    return typeof record.path === "string" && record.path.trim() !== "" ? { path: record.path } : {};
  }
};

/** lfaa_read_image：通过目标 Daemon 读取图片，并把图片块传给当前模型。 */
const readImageTool: Pick<AiBusinessTool, "id" | "name" | "coreManaged" | "description" | "applicationIds" | "schema" | "parse"> = {
  id: "fs.read-image",
  name: "lfaa_read_image",
  coreManaged: true,
  description: "读取目标节点项目中不超过 512 KiB 的 PNG/JPEG/WebP 图片，以真实图片块交给支持视觉的当前模型。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: { path: { type: "string", minLength: 1, maxLength: 1024 } },
    required: ["path"],
    additionalProperties: false
  },
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("read_image 参数必须是对象。");
    const record = value as Record<string, unknown>;
    if (typeof record.path !== "string" || record.path.trim().length === 0) throw new Error("path 为必填非空字符串。");
    return { path: record.path };
  }
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
  }
}

export const name = "lfaaToolFs";
export const inject = ["lfaaTools"] as const;

/** 注册项目读/写/删除/列目录/读图片模型工具；每个工具复用同一个 Daemon 文件 Owner。 */
export function apply(ctx: Context): void {
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(readFileTool, "read_lines"));
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(writeFileTool, "write"));
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(deleteFileTool, "delete"));
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(listDirTool, "list"));
  ctx.lfaaTools.registerTool(ctx, projectFileAlias(readImageTool, "read_image"));
}
