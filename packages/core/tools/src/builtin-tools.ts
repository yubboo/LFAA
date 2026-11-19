// 提供内置核心工作区工具集（读文件、列目录、文本搜索、写文件、局部替换、命令执行）。
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { executeShell, type ShellService } from "@lfaa/shell";
import { createPrivatePathFilter, resolveSafeWorkspacePath, resolveSafeWorkspaceRoot } from "./sandbox";
import type { AgentToolDefinition, ToolFileChange } from "./types";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"]);

/** 去掉双方共有的首尾行，限制为本次写入的变更片段。 */
function captureFileChange(path: string, resolvedPath: string, previous: string | null, next: string): ToolFileChange {
  const beforeLines = previous ? previous.split("\n") : [];
  const afterLines = next ? next.split("\n") : [];
  let start = 0;
  let beforeEnd = beforeLines.length;
  let afterEnd = afterLines.length;
  while (start < beforeEnd && start < afterEnd && beforeLines[start] === afterLines[start]) start += 1;
  while (beforeEnd > start && afterEnd > start && beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  const before = beforeLines.slice(start, beforeEnd).join("\n");
  const after = afterLines.slice(start, afterEnd).join("\n");
  const limit = 8000;
  return {
    path,
    resolvedPath,
    operation: previous === null ? "created" : "edited",
    firstLine: start + 1,
    before: before.slice(0, limit),
    after: after.slice(0, limit),
    truncated: before.length > limit || after.length > limit,
  };
}

function countLineDiff(prevText: string, nextText: string): { added: number; removed: number } {
  const nextLines = nextText ? nextText.split(/\r?\n/) : [];
  if (!prevText) {
    return { added: nextLines.length, removed: 0 };
  }
  const prevLines = prevText.split(/\r?\n/);
  const prevCounts = new Map<string, number>();
  for (const line of prevLines) {
    prevCounts.set(line, (prevCounts.get(line) ?? 0) + 1);
  }
  let matched = 0;
  for (const line of nextLines) {
    const count = prevCounts.get(line) ?? 0;
    if (count > 0) {
      matched += 1;
      prevCounts.set(line, count - 1);
    }
  }
  return {
    added: Math.max(0, nextLines.length - matched),
    removed: Math.max(0, prevLines.length - matched),
  };
}

/** 构造默认本地工作区工具，统一通过工具上下文接收路径和权限约束。 */
export function createBuiltinWorkspaceTools(executeCommand: ShellService["execute"] = executeShell): AgentToolDefinition[] {
  return [
    {
      name: "list_dir",
      title: "列出目录",
      description: "列出工作区目录中的文件与子目录。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对或绝对目录路径，默认为工作区根目录 ." },
        },
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : ".";
        const { path: targetDir } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const entries = await readdir(targetDir, { withFileTypes: true });
        const isPrivate = await createPrivatePathFilter();
        const visible = entries.filter((entry) => !IGNORED_DIRS.has(entry.name) && !isPrivate(join(targetDir, entry.name)));
        const lines = visible
          .slice(0, 120)
          .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
          .map((e) => `${e.isDirectory() ? "[dir] " : "[file]"} ${e.name}`);
        return {
          ok: true,
          output: lines.join("\n") || "(空目录)",
          summary: `列出 ${visible.length} 项内容`,
        };
      },
    },
    {
      name: "read_file",
      title: "读取文件",
      description: "按行范围读取工作区内的文本文件内容。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          startLine: { type: "number", description: "起始行（从 1 开始，可选）" },
          endLine: { type: "number", description: "结束行（含，可选，单次建议不超过 200 行）" },
        },
        required: ["path"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const raw = await readFile(targetFile, "utf8");
        const allLines = raw.split(/\r?\n/u);
        const start = Math.max(1, typeof args.startLine === "number" ? Math.floor(args.startLine) : 1);
        const end = Math.min(allLines.length, typeof args.endLine === "number" ? Math.floor(args.endLine) : start + 199);
        const slice = allLines.slice(start - 1, end).map((line, i) => `${start + i}: ${line}`);
        return {
          ok: true,
          output: slice.join("\n").slice(0, 24000),
          summary: `读取 ${relative(ctx.workspaceRoots[0] ?? "", targetFile) || rawPath} (${start}-${end}/${allLines.length})`,
        };
      },
    },
    {
      name: "search_files",
      title: "搜索文件内容",
      description: "在工作区文本文件中搜索指定关键词并返回命中行。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索文本关键词" },
          path: { type: "string", description: "检索起始目录，默认 ." },
        },
        required: ["query"],
      },
      async execute(args, ctx) {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) return { ok: false, output: "搜索关键词不能为空。", summary: "缺少关键词" };
        const { path: startDir } = await resolveSafeWorkspacePath(
          typeof args.path === "string" ? args.path : ".",
          ctx.workspaceRoots,
          { allowOutsideWorkspace: ctx.allowOutsideWorkspace },
        );
        const matches: string[] = [];
        const needle = query.toLowerCase();
        const isPrivate = await createPrivatePathFilter();

        const walk = async (dir: string): Promise<void> => {
          if (ctx.signal.aborted || matches.length >= 40) return;
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (matches.length >= 40) break;
            if (IGNORED_DIRS.has(entry.name)) continue;
            const full = join(dir, entry.name);
            if (isPrivate(full)) continue;
            if (entry.isDirectory()) {
              await walk(full);
              continue;
            }
            if (!entry.isFile()) continue;
            try {
              const info = await stat(full);
              if (info.size > 256 * 1024) continue;
              const text = await readFile(full, "utf8");
              if (text.includes("\u0000")) continue;
              const lines = text.split(/\r?\n/u);
              for (let idx = 0; idx < lines.length; idx += 1) {
                if (lines[idx]!.toLowerCase().includes(needle)) {
                  matches.push(`${relative(startDir, full)}:${idx + 1}: ${lines[idx]!.trim().slice(0, 160)}`);
                  if (matches.length >= 40) break;
                }
              }
            } catch {
              // 跳过无法读取的文件。
            }
          }
        };

        await walk(startDir);
        return {
          ok: true,
          output: matches.join("\n") || `未找到匹配 "${query}" 的内容。`,
          summary: `命中 ${matches.length} 处匹配`,
        };
      },
    },
    {
      name: "write_file",
      title: "写入文件",
      description: "在工作区内创建或覆写文本文件（需人工授权）。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const content = typeof args.content === "string" ? args.content : "";
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const previousContent = await readFile(targetFile, "utf8").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        await mkdir(dirname(targetFile), { recursive: true });
        await writeFile(targetFile, content, { encoding: "utf8", flag: previousContent === null ? "wx" : "w" });
        const diff = countLineDiff(previousContent ?? "", content);
        return {
          ok: true,
          output: `已写入文件：${targetFile}（${content.length} 字符）`,
          summary: `已写入 ${rawPath}`,
          metadata: { filePath: rawPath, added: diff.added, removed: diff.removed },
          fileChange: captureFileChange(rawPath, targetFile, previousContent, content),
        };
      },
    },
    {
      name: "edit_file",
      title: "局部编辑文件",
      description: "将工作区内指定文件的精确旧片段替换为新片段（需人工授权）。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          target: { type: "string", description: "精确匹配的现有文本" },
          replacement: { type: "string", description: "替换后的新文本" },
        },
        required: ["path", "target", "replacement"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const target = typeof args.target === "string" ? args.target : "";
        const replacement = typeof args.replacement === "string" ? args.replacement : "";
        if (!target) return { ok: false, output: "target 不能为空。", summary: "参数无效" };
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const existing = await readFile(targetFile, "utf8");
        if (!existing.includes(target)) {
          return { ok: false, output: `文件 ${rawPath} 中未找到匹配 target 片段。`, summary: "未命中替换文本" };
        }
        const next = existing.split(target).join(replacement);
        await writeFile(targetFile, next, "utf8");
        const diff = countLineDiff(existing, next);
        return {
          ok: true,
          output: `已更新文件：${rawPath}`,
          summary: `已编辑 ${rawPath}`,
          metadata: { filePath: rawPath, added: diff.added, removed: diff.removed },
          fileChange: captureFileChange(rawPath, targetFile, existing, next),
        };
      },
    },
    {
      name: "run_command",
      title: "执行终端命令",
      description: "在工作区根目录执行受超时限制的终端命令（需人工授权）。",
      permissionLevel: "exec",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "待执行命令" },
        },
        required: ["command"],
      },
      async execute(args, ctx) {
        const command = typeof args.command === "string" ? args.command.trim() : "";
        if (!command) return { ok: false, output: "命令不能为空。", summary: "命令为空" };
        const cwd = await resolveSafeWorkspaceRoot(ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const result = await executeCommand({ command, cwd, signal: ctx.signal, onOutput: ctx.onCommandOutput });
        return {
          ok: result.ok,
          output: result.output || "(命令执行完成，无输出)",
          summary: result.ok ? "命令执行成功" : result.exitCode === undefined ? "命令执行中断" : `命令执行失败，退出码 ${result.exitCode}`,
          ...(result.exitCode === undefined ? {} : { metadata: { exitCode: result.exitCode } }),
        };
      },
    },
  ];
}
