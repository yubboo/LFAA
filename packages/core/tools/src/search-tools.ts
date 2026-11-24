// 提供 glob 文件名匹配与 grep 正则内容检索两个只读工具，替代整树逐文件盲目扫描。
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { resolveSafeWorkspacePath } from "@lfaa/fs";
import { walkWorkspaceFiles } from "@lfaa/fs";
import type { AgentToolDefinition } from "./types";

/** 把 glob 模式转成正则：支持 **、*、?；模式不含分隔符时在任意目录深度匹配。 */
export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/gu, "/").trim() || "**/*";
  const source = normalized.includes("/") ? normalized : `**/${normalized}`;
  let regex = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === "*") {
      if (source[index + 1] === "*") {
        if (source[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 2;
        } else {
          regex += ".*";
          index += 1;
        }
      } else {
        regex += "[^/]*";
      }
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`^${regex}$`, "u");
}

function readLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

/** 构造 glob 与 grep 工具，统一使用工作区路径沙箱与遍历过滤器。 */
export function createSearchTools(): AgentToolDefinition[] {
  return [
    {
      name: "glob",
      title: "按文件名匹配",
      description: "用 glob 模式（**、*、?）在工作区查找文件路径，返回相对路径列表（只读）。适合先定位文件再精读。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "glob 模式，如 **/*.ts、src/**/index.ts 或 *.json" },
          path: { type: "string", description: "检索起始目录或单个文件路径，默认工作区根目录 ." },
          limit: { type: "number", description: "最多返回条数，默认 200，上限 1000" },
        },
        required: ["pattern"],
      },
      async execute(args, ctx) {
        const pattern = typeof args.pattern === "string" ? args.pattern.trim() : "";
        if (!pattern) return { ok: false, output: "pattern 不能为空。", summary: "缺少匹配模式" };
        const { path: startDir } = await resolveSafeWorkspacePath(
          typeof args.path === "string" ? args.path : ".",
          ctx.workspaceRoots,
          { allowOutsideWorkspace: ctx.allowOutsideWorkspace },
        );
        const matcher = globToRegExp(pattern);
        const limit = readLimit(args.limit, 200, 1000);
        const files = await walkWorkspaceFiles(startDir, { signal: ctx.signal, maxFiles: 8000 });
        const matches = files
          .map((file) => file.relativePath.replace(/\\/gu, "/"))
          .filter((filePath) => matcher.test(filePath))
          .sort()
          .slice(0, limit);
        return {
          ok: true,
          output: matches.join("\n") || `未找到匹配 ${pattern} 的文件。`,
          summary: `匹配 ${matches.length} 个文件`,
        };
      },
    },
    {
      name: "grep",
      title: "正则检索内容",
      description: "用 JavaScript 正则检索工作区文本文件内容，可用 include 过滤文件名，返回 文件:行号: 内容（只读）。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "JavaScript 正则表达式，如 export class \\w+Tool" },
          path: { type: "string", description: "检索起始目录或单个文件路径，默认工作区根目录 ." },
          include: { type: "string", description: "文件名过滤 glob，如 *.ts 或 src/**/*.ts（可选）" },
          limit: { type: "number", description: "最多命中行数，默认 60，上限 200" },
        },
        required: ["query"],
      },
      async execute(args, ctx) {
        const query = typeof args.query === "string" ? args.query : "";
        if (!query.trim()) return { ok: false, output: "检索表达式不能为空。", summary: "缺少表达式" };
        let matcher: RegExp;
        try {
          matcher = new RegExp(query, "u");
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          return { ok: false, output: `正则表达式无效：${reason}`, summary: "正则表达式无效" };
        }
        const { path: startPath } = await resolveSafeWorkspacePath(
          typeof args.path === "string" ? args.path : ".",
          ctx.workspaceRoots,
          { allowOutsideWorkspace: ctx.allowOutsideWorkspace },
        );
        const include = typeof args.include === "string" && args.include.trim() ? globToRegExp(args.include) : null;
        const limit = readLimit(args.limit, 60, 200);
        // 兼容传入单个文件路径与目录路径，避免对文件执行 readdir 触发 ENOTDIR 迫使模型重试。
        const targetStat = await stat(startPath).catch(() => null);
        if (!targetStat) {
          return { ok: false, output: `路径不存在：${typeof args.path === "string" ? args.path : "."}`, summary: "路径不存在" };
        }
        const files = targetStat.isFile()
          ? [{ path: startPath, relativePath: typeof args.path === "string" && args.path.trim() ? args.path.replace(/\\/gu, "/") : basename(startPath) }]
          : await walkWorkspaceFiles(startPath, { signal: ctx.signal, maxBytes: 1024 * 1024, maxFiles: 8000 });
        const matches: string[] = [];
        for (const file of files) {
          if (ctx.signal.aborted || matches.length >= limit) break;
          const relativePath = file.relativePath.replace(/\\/gu, "/");
          if (include && !include.test(relativePath)) continue;
          try {
            const text = await readFile(file.path, "utf8");
            if (text.includes("\u0000")) continue;
            const lines = text.split(/\r?\n/u);
            for (let index = 0; index < lines.length; index += 1) {
              if (!matcher.test(lines[index]!)) continue;
              matches.push(`${relativePath}:${index + 1}: ${lines[index]!.trim().slice(0, 200)}`);
              if (matches.length >= limit) break;
            }
          } catch {
            // 跳过无法读取的文件。
          }
        }
        return {
          ok: true,
          output: matches.join("\n") || `未找到匹配 /${query}/ 的内容。`,
          summary: `命中 ${matches.length} 处`,
        };
      },
    },
  ];
}
